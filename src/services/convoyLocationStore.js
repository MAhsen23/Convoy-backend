import { haversineKm } from '../utils/haversine.js';
const MAX_SEGMENT_KM = Number(process.env.CONVOY_LOCATION_MAX_SEGMENT_KM || 5);
const ROUTE_MIN_SEGMENT_KM = Number(process.env.DRIVE_ROUTE_MIN_SEGMENT_KM || 0.05);
const ROUTE_MAX_POINTS = Number(process.env.DRIVE_ROUTE_MAX_POINTS || 2000);

/** @type {Map<number, Map<number, object>>} */
const buckets = new Map();

/** @type {Map<number, Map<number, Array<{ lat: number, lng: number, recorded_at: string }>>>} */
const routeBuckets = new Map();

const getBucket = (convoyId) => {
    let b = buckets.get(convoyId);
    if (!b) {
        b = new Map();
        buckets.set(convoyId, b);
    }
    return b;
};

const getRouteBucket = (convoyId) => {
    let b = routeBuckets.get(convoyId);
    if (!b) {
        b = new Map();
        routeBuckets.set(convoyId, b);
    }
    return b;
};

const appendRoutePoint = (convoyId, userId, lat, lng, recordedAt) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const bucket = getRouteBucket(convoyId);
    let points = bucket.get(userId);
    if (!points) {
        points = [];
        bucket.set(userId, points);
    }
    const last = points[points.length - 1];
    if (last) {
        const d = haversineKm(last.lat, last.lng, lat, lng);
        if (d < ROUTE_MIN_SEGMENT_KM) return;
    }
    points.push({ lat, lng, recorded_at: recordedAt });
    if (points.length > ROUTE_MAX_POINTS) {
        bucket.set(userId, downsampleRoutePoints(points, ROUTE_MAX_POINTS));
    }
};

const downsampleRoutePoints = (points, maxPoints) => {
    if (points.length <= maxPoints) return points;
    const step = Math.ceil(points.length / maxPoints);
    const out = [];
    for (let i = 0; i < points.length; i += step) {
        out.push(points[i]);
    }
    const last = points[points.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    return out;
};

/**
 * @param {number} convoyId
 * @param {number} userId
 * @param {string} username
 * @param {{ lat: number, lng: number, heading?: number|null, speed?: number|null }} coords
 */
export const recordLocationUpdate = (convoyId, userId, username, { lat, lng, heading, speed }) => {
    const bucket = getBucket(convoyId);
    const prev = bucket.get(userId);
    const now = new Date().toISOString();
    let deltaKm = 0;
    if (
        prev &&
        typeof prev.lat === 'number' &&
        typeof prev.lng === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
    ) {
        const d = haversineKm(prev.lat, prev.lng, lat, lng);
        if (d <= MAX_SEGMENT_KM && d >= 0) deltaKm = d;
    }
    const distance_km = (prev?.distance_km || 0) + deltaKm;
    const row = {
        user_id: userId,
        username,
        lat,
        lng,
        heading: heading != null && Number.isFinite(Number(heading)) ? Number(heading) : null,
        speed: speed != null && Number.isFinite(Number(speed)) ? Number(speed) : null,
        updated_at: now,
        distance_km
    };
    bucket.set(userId, row);
    if (!prev || deltaKm > 0) {
        appendRoutePoint(convoyId, userId, lat, lng, now);
    }
    return { deltaKm, distance_km, row };
};

export const getMemberDistanceKm = (convoyId, userId) => {
    const b = buckets.get(convoyId);
    const row = b?.get(userId);
    return row?.distance_km ?? 0;
};

export const removeMemberFromLocationStore = (convoyId, userId) => {
    const b = buckets.get(convoyId);
    if (!b) return;
    b.delete(userId);
    if (b.size === 0) buckets.delete(convoyId);
};

/**
 * Merge active members (from DB) with last-known positions from memory.
 * @param {number} convoyId
 * @param {Array<{ user_id?: number, users?: { id?: number, username?: string } }>} activeMembers
 */
export const getMergedMemberLocations = (convoyId, activeMembers) => {
    const b = buckets.get(convoyId);
    return (activeMembers || []).map((m) => {
        const userId = m.user_id ?? m.users?.id;
        const username = m.users?.username ?? '';
        const stored = b?.get(userId);
        return {
            user_id: userId,
            username,
            lat: stored?.lat ?? null,
            lng: stored?.lng ?? null,
            heading: stored?.heading ?? null,
            updated_at: stored?.updated_at ?? null,
            distance_km: stored?.distance_km ?? 0
        };
    });
};

/**
 * Build ride stats from memory for each active member (does not clear the bucket).
 * @param {number} convoyId
 * @param {Array<{ user_id?: number, users?: { id?: number, username?: string } }>} activeMembers
 */
export const takeFinalRideStatsForActiveMembers = (convoyId, activeMembers) => {
    const b = buckets.get(convoyId);
    const store = b || new Map();
    return (activeMembers || []).map((m) => {
        const userId = m.user_id ?? m.users?.id;
        const username = m.users?.username ?? '';
        const stored = store.get(userId);
        return {
            user_id: userId,
            username,
            distance_km: stored?.distance_km ?? 0,
            lat: stored?.lat ?? null,
            lng: stored?.lng ?? null,
            heading: stored?.heading ?? null,
            speed: stored?.speed ?? null,
            updated_at: stored?.updated_at ?? null
        };
    });
};

export const getRouteCoordinatesForUser = (convoyId, userId) => {
    const b = routeBuckets.get(convoyId);
    const points = b?.get(userId);
    return points ? [...points] : [];
};

/**
 * @param {number} convoyId
 * @param {Array<{ user_id?: number, users?: { id?: number } }>} members
 */
export const takeAllRouteCoordinatesForConvoy = (convoyId, members) => {
    const b = routeBuckets.get(convoyId) || new Map();
    const out = {};
    for (const m of members || []) {
        const userId = m.user_id ?? m.users?.id;
        if (!Number.isInteger(userId)) continue;
        const points = b.get(userId);
        out[userId] = points ? [...points] : [];
    }
    return out;
};

export const setRouteCoordinatesForUser = (convoyId, userId, coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;
    const bucket = getRouteBucket(convoyId);
    const normalized = coordinates
        .map((p) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            recorded_at: p.recorded_at ? String(p.recorded_at) : new Date().toISOString()
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    bucket.set(userId, downsampleRoutePoints(normalized, ROUTE_MAX_POINTS));
};

export const clearConvoyLocationBucket = (convoyId) => {
    buckets.delete(convoyId);
    routeBuckets.delete(convoyId);
};
