import * as driveRecapModel from '../models/driveRecapModel.js';
import * as convoyModel from '../models/convoyModel.js';

const XP_PER_KM = Number(process.env.XP_PER_KM || 10);
const MAX_XP_PER_CONVOY = Number(process.env.MAX_XP_PER_CONVOY || 500);

export const computeAverageSpeedKmh = (distanceKm, durationMinutes) => {
    const km = Math.max(0, Number(distanceKm) || 0);
    const hours = Math.max(0, Number(durationMinutes) || 0) / 60;
    if (hours <= 0 || km <= 0) return null;
    return Math.round((km / hours) * 100) / 100;
};

const buildShareText = ({ convoyName, distanceKm, durationMinutes, convoySize, xpEarned }) => {
    const name = convoyName ? `"${convoyName}"` : 'my convoy drive';
    const dist = Math.round((Number(distanceKm) || 0) * 10) / 10;
    const dur = Math.max(0, Number(durationMinutes) || 0);
    const size = Math.max(0, Number(convoySize) || 0);
    const xp = Math.max(0, Number(xpEarned) || 0);
    return `Just finished ${name} — ${dist} km in ${dur} min with ${size} drivers. +${xp} XP on Convoy!`;
};

const computeMembershipDurationMinutes = (membership, convoy) => {
    if (membership?.joined_at && membership?.left_at) {
        return Math.max(
            0,
            Math.round(
                (new Date(membership.left_at).getTime() - new Date(membership.joined_at).getTime()) / 60000
            )
        );
    }
    if (convoy?.started_at && convoy?.ended_at) {
        return Math.max(
            0,
            Math.round(
                (new Date(convoy.ended_at).getTime() - new Date(convoy.started_at).getTime()) / 60000
            )
        );
    }
    return 0;
};

const destinationFromConvoy = (convoy) => {
    if (!convoy) return null;
    if (convoy.destination_lat == null || convoy.destination_lng == null) return null;
    return {
        lat: convoy.destination_lat,
        lng: convoy.destination_lng,
        name: convoy.destination_name ?? null,
        address: convoy.destination_address ?? null,
        place_id: convoy.destination_place_id ?? null
    };
};

const formatRecapRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        convoy_id: row.convoy_id,
        user_id: row.user_id,
        convoy_name: row.convoy_name ?? null,
        convoy_code: row.convoy_code ?? null,
        role: row.role ?? null,
        distance_km: Number(row.distance_km) || 0,
        duration_minutes: row.duration_minutes ?? 0,
        average_speed_kmh: row.average_speed_kmh != null ? Number(row.average_speed_kmh) : null,
        convoy_size: row.convoy_size ?? 0,
        xp_earned: row.xp_earned ?? 0,
        achievements_unlocked: row.achievements_unlocked || [],
        route_coordinates: row.route_coordinates || [],
        destination: row.destination ?? null,
        share_text: row.share_text ?? null,
        created_at: row.created_at
    };
};

/**
 * @param {number} convoyId
 * @param {object} convoy
 * @param {Array} members
 * @param {Record<number, Array>} routeByUserId
 * @param {Record<number, { xp_earned?: number, achievements_unlocked?: Array }>} gamificationByUserId
 */
export const createDriveRecapsForConvoy = async (
    convoyId,
    convoy,
    members,
    routeByUserId = {},
    gamificationByUserId = {}
) => {
    const uniqueMembers = new Map();
    for (const m of members || []) {
        const userId = m.user_id;
        if (!Number.isInteger(userId)) continue;
        const existing = uniqueMembers.get(userId);
        if (!existing) {
            uniqueMembers.set(userId, { ...m });
        } else {
            existing.distance_km = Math.max(existing.distance_km || 0, m.distance_km || 0);
            if (m.left_at && (!existing.left_at || new Date(m.left_at) > new Date(existing.left_at))) {
                existing.left_at = m.left_at;
                existing.joined_at = m.joined_at;
                existing.role = m.role;
            }
        }
    }

    const convoySize = uniqueMembers.size;
    const destination = destinationFromConvoy(convoy);
    const created = [];

    for (const membership of uniqueMembers.values()) {
        const userId = membership.user_id;
        const distanceKm = Math.max(0, Number(membership.distance_km) || 0);
        const durationMinutes = computeMembershipDurationMinutes(membership, convoy);
        const averageSpeedKmh = computeAverageSpeedKmh(distanceKm, durationMinutes);
        const gam = gamificationByUserId[userId] || {};
        const xpEarned =
            gam.xp_earned != null
                ? gam.xp_earned
                : Math.min(Math.floor(distanceKm * XP_PER_KM), MAX_XP_PER_CONVOY);
        const achievements = gam.achievements_unlocked || [];
        const routeCoordinates = routeByUserId[userId] || [];

        const row = await driveRecapModel.upsertDriveRecap({
            convoy_id: convoyId,
            user_id: userId,
            distance_km: Math.round(distanceKm * 1000) / 1000,
            duration_minutes: durationMinutes,
            average_speed_kmh: averageSpeedKmh,
            convoy_size: convoySize,
            xp_earned: xpEarned,
            achievements_unlocked: achievements,
            route_coordinates: routeCoordinates.length > 0 ? routeCoordinates : null,
            destination,
            convoy_name: convoy?.name ?? null,
            convoy_code: convoy?.code ?? null,
            role: membership.role ?? 'member',
            share_text: buildShareText({
                convoyName: convoy?.name,
                distanceKm,
                durationMinutes,
                convoySize,
                xpEarned
            })
        });
        created.push(row);
    }

    return created.map(formatRecapRow);
};

export const getDriveRecap = async (convoyId, userId) => {
    const membership = await convoyModel.getMemberAnyStatus(convoyId, userId);
    if (!membership) {
        const err = new Error('You are not a member of this convoy');
        err.statusCode = 403;
        throw err;
    }

    const recap = await driveRecapModel.getDriveRecapForUser(convoyId, userId);
    if (!recap) {
        const convoy = await convoyModel.getConvoyById(convoyId);
        if (!convoy || convoy.status !== 'ended') {
            const err = new Error('Drive recap is not available yet');
            err.statusCode = 404;
            throw err;
        }
        const err = new Error('Drive recap is being prepared. Try again shortly.');
        err.statusCode = 404;
        throw err;
    }

    return formatRecapRow(recap);
};

export const uploadRouteCoordinates = async (convoyId, userId, coordinates) => {
    const membership = await convoyModel.getMemberAnyStatus(convoyId, userId);
    if (!membership) {
        const err = new Error('You are not a member of this convoy');
        err.statusCode = 403;
        throw err;
    }

    const convoy = await convoyModel.getConvoyById(convoyId);
    if (!convoy || convoy.status !== 'ended') {
        const err = new Error('Route upload is only allowed after the convoy has ended');
        err.statusCode = 409;
        throw err;
    }

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        const err = new Error('coordinates must be a non-empty array');
        err.statusCode = 400;
        throw err;
    }

    const maxPoints = Number(process.env.DRIVE_ROUTE_MAX_POINTS || 2000);
    const normalized = coordinates
        .slice(0, maxPoints)
        .map((p) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            recorded_at: p.recorded_at ? String(p.recorded_at) : null
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (normalized.length === 0) {
        const err = new Error('No valid coordinates provided');
        err.statusCode = 400;
        throw err;
    }

    let recap = await driveRecapModel.getDriveRecapForUser(convoyId, userId);
    if (recap) {
        recap = await driveRecapModel.updateDriveRecapRoute(convoyId, userId, normalized);
    } else {
        const members = await convoyModel.listMembersAnyStatus(convoyId);
        const routeByUserId = { [userId]: normalized };
        const created = await createDriveRecapsForConvoy(convoyId, convoy, members, routeByUserId, {});
        recap = created.find((r) => r.user_id === userId) || null;
        if (recap) {
            recap = await driveRecapModel.getDriveRecapForUser(convoyId, userId);
        }
    }

    return formatRecapRow(recap);
};

export const listUserRecaps = async (userId, limit, offset) => {
    const { recaps, total, limit: safeLimit, offset: safeOffset } = await driveRecapModel.listUserDriveRecaps(
        userId,
        limit,
        offset
    );
    return {
        recaps: recaps.map(formatRecapRow),
        pagination: {
            total,
            limit: safeLimit,
            offset: safeOffset,
            hasMore: safeOffset + safeLimit < total
        }
    };
};
