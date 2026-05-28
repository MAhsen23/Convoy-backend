import { haversineKm } from '../utils/haversine.js';
import * as hazardModel from '../models/hazardModel.js';
import { getSocketIdsForPoint } from './hazardSubscriptionStore.js';
import { getIO } from '../socket/io.js';

const REPORTS_PER_HOUR_LIMIT = Number(process.env.HAZARD_REPORTS_PER_HOUR || 10);
const DUPLICATE_RADIUS_KM = Number(process.env.HAZARD_DUPLICATE_RADIUS_KM || 0.2);
const DUPLICATE_WINDOW_MINUTES = Number(process.env.HAZARD_DUPLICATE_WINDOW_MINUTES || 15);
const NEARBY_DEFAULT_LIMIT = 100;
const NEARBY_MAX_LIMIT = 200;
const MAX_BBOX_SPAN_DEG = Number(process.env.HAZARD_MAX_BBOX_SPAN_DEG || 0.5);

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

export const trustScore = (confirm_count, reject_count) =>
    Math.max(0, Math.min(100, (confirm_count || 0) * 10 - (reject_count || 0) * 15));

export const toPublicHazard = (row, myVote = null) => {
    const reporter = row.reporter
        ? {
              id: row.reporter.id,
              username: row.reporter.username,
              display_name: row.reporter.display_name ?? null,
              profile_picture_url: row.reporter.profile_picture_url ?? null
          }
        : null;

    return {
        id: row.id,
        type: row.type,
        lat: Number(row.lat),
        lng: Number(row.lng),
        heading: row.heading != null ? Number(row.heading) : null,
        description: row.description ?? null,
        status: row.status,
        confirm_count: row.confirm_count,
        reject_count: row.reject_count,
        trust_score: trustScore(row.confirm_count, row.reject_count),
        expires_at: row.expires_at,
        last_confirmed_at: row.last_confirmed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        reporter,
        my_vote: myVote
    };
};

const emitToSubscribers = (event, hazard, excludeUserId = null) => {
    const io = getIO();
    if (!io) return;
    const socketIds = getSocketIdsForPoint(
        { lat: Number(hazard.lat), lng: Number(hazard.lng) },
        excludeUserId
    );
    const payload = { hazard: toPublicHazard(hazard) };
    socketIds.forEach((socketId) => io.to(socketId).emit(event, payload));
};

export const parseBbox = (query) => {
    const min_lat = Number(query.min_lat);
    const max_lat = Number(query.max_lat);
    const min_lng = Number(query.min_lng);
    const max_lng = Number(query.max_lng);

    if (
        !Number.isFinite(min_lat) ||
        !Number.isFinite(max_lat) ||
        !Number.isFinite(min_lng) ||
        !Number.isFinite(max_lng)
    ) {
        return { error: 'min_lat, max_lat, min_lng, max_lng are required' };
    }
    if (min_lat > max_lat || min_lng > max_lng) {
        return { error: 'Invalid bbox: min must be <= max' };
    }
    if (max_lat - min_lat > MAX_BBOX_SPAN_DEG || max_lng - min_lng > MAX_BBOX_SPAN_DEG) {
        return { error: `Bbox too large (max ${MAX_BBOX_SPAN_DEG}° per axis)` };
    }

    return { bbox: { min_lat, max_lat, min_lng, max_lng } };
};

export const listTypes = () => hazardModel.listHazardTypes();

export const getNearby = async (userId, query) => {
    const parsed = parseBbox(query);
    if (parsed.error) return { error: parsed.error, status: 400 };

    const limit = Math.min(
        Math.max(parseInt(query.limit, 10) || NEARBY_DEFAULT_LIMIT, 1),
        NEARBY_MAX_LIMIT
    );
    const types =
        typeof query.types === 'string' && query.types.trim()
            ? query.types.split(',').map((t) => t.trim())
            : null;

    const rows = await hazardModel.listNearbyActive({
        ...parsed.bbox,
        types,
        limit
    });

    const hazards = await Promise.all(
        rows.map(async (row) => {
            const vote = await hazardModel.getVote(row.id, userId);
            return toPublicHazard(row, vote?.vote ?? null);
        })
    );

    return { hazards };
};

export const createReport = async (userId, body, reporterUser = null) => {
    const type = String(body.type || '').trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const heading =
        body.heading === undefined || body.heading === null ? null : Number(body.heading);
    const description =
        typeof body.description === 'string' && body.description.trim()
            ? body.description.trim().slice(0, 280)
            : null;

    if (!hazardModel.HAZARD_TYPES.includes(type)) {
        return { error: 'Invalid hazard type', status: 400 };
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { error: 'Invalid lat', status: 400 };
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { error: 'Invalid lng', status: 400 };
    }
    if (heading != null && (!Number.isFinite(heading) || heading < 0 || heading > 360)) {
        return { error: 'Invalid heading', status: 400 };
    }

    const typeRow = await hazardModel.getHazardType(type);
    if (!typeRow) return { error: 'Hazard type not available', status: 400 };

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentCount = await hazardModel.countRecentReportsByUser(userId, hourAgo);
    if (recentCount >= REPORTS_PER_HOUR_LIMIT) {
        return { error: 'Report rate limit reached. Try again later.', status: 429 };
    }

    const dupWindow = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const recent = await hazardModel.listRecentReportsByUser(userId, dupWindow);
    for (const r of recent) {
        if (haversineKm(lat, lng, Number(r.lat), Number(r.lng)) < DUPLICATE_RADIUS_KM) {
            return { error: 'You recently reported a hazard very close to this location', status: 429 };
        }
    }

    const expires_at = addMinutes(new Date(), typeRow.default_ttl_minutes).toISOString();

    const row = await hazardModel.createReport({
        reporter_id: userId,
        type,
        lat,
        lng,
        heading,
        description,
        expires_at,
        status: 'active'
    });

    const withReporter = {
        ...row,
        reporter: reporterUser
            ? {
                  id: reporterUser.id,
                  username: reporterUser.username,
                  display_name: reporterUser.display_name ?? null,
                  profile_picture_url: reporterUser.profile_picture_url ?? null
              }
            : { id: userId }
    };

    emitToSubscribers('hazard:new', withReporter, userId);

    return {
        hazard: toPublicHazard(
            { ...row, reporter: withReporter.reporter },
            null
        )
    };
};

export const voteOnReport = async (userId, hazardId, vote) => {
    if (!['confirm', 'reject'].includes(vote)) {
        return { error: 'vote must be confirm or reject', status: 400 };
    }

    const report = await hazardModel.getReportById(hazardId);
    if (!report) return { error: 'Hazard not found', status: 404 };
    if (report.status !== 'active') {
        return { error: 'Hazard is no longer active', status: 400 };
    }
    if (new Date(report.expires_at).getTime() <= Date.now()) {
        return { error: 'Hazard has expired', status: 400 };
    }

    await hazardModel.upsertVote(hazardId, userId, vote);
    const { confirm_count, reject_count } = await hazardModel.countVotes(hazardId);

    const typeRow = await hazardModel.getHazardType(report.type);
    let expires_at = report.expires_at;
    let last_confirmed_at = report.last_confirmed_at;
    let status = 'active';

    if (vote === 'confirm' && typeRow) {
        const extended = addMinutes(new Date(), typeRow.confirm_extend_minutes);
        const maxExpires = addMinutes(new Date(report.created_at), typeRow.max_ttl_minutes);
        const candidate = extended > new Date(expires_at) ? extended : new Date(expires_at);
        expires_at = (candidate > maxExpires ? maxExpires : candidate).toISOString();
        last_confirmed_at = new Date().toISOString();
    }

    if (reject_count >= 5 && reject_count > confirm_count + 1) {
        status = 'removed';
    }

    const updated = await hazardModel.updateReport(hazardId, {
        confirm_count,
        reject_count,
        expires_at,
        last_confirmed_at,
        status
    });

    const event = status === 'removed' ? 'hazard:expired' : 'hazard:updated';
    emitToSubscribers(event, updated);

    const myVote = await hazardModel.getVote(hazardId, userId);
    return { hazard: toPublicHazard(updated, myVote?.vote ?? vote) };
};

export const getReport = async (userId, hazardId) => {
    const report = await hazardModel.getReportById(hazardId);
    if (!report) return { error: 'Hazard not found', status: 404 };
    const vote = await hazardModel.getVote(hazardId, userId);
    return { hazard: toPublicHazard(report, vote?.vote ?? null) };
};

export const listMyReports = async (userId, query) => {
    const limit = parseInt(query.limit, 10) || 20;
    const offset = parseInt(query.offset, 10) || 0;
    const result = await hazardModel.listMyReports(userId, limit, offset);
    return {
        reports: result.reports.map((r) => toPublicHazard(r, null)),
        total: result.total,
        limit: result.limit,
        offset: result.offset
    };
};

let expiryTimer = null;

export const runExpirySweep = async () => {
    const expired = await hazardModel.expireDueReports();
    for (const row of expired) {
        emitToSubscribers('hazard:expired', { ...row, status: 'expired' });
    }
    return expired.length;
};

export const startHazardExpiryJob = () => {
    if (expiryTimer) return;
    const intervalMs = Number(process.env.HAZARD_EXPIRY_SWEEP_MS || 120000);
    expiryTimer = setInterval(() => {
        void runExpirySweep().catch(() => {});
    }, intervalMs);
    void runExpirySweep().catch(() => {});
};
