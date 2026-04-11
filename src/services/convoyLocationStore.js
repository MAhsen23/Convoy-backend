import { haversineKm } from '../utils/haversine.js';
const MAX_SEGMENT_KM = Number(process.env.CONVOY_LOCATION_MAX_SEGMENT_KM || 5);

/** @type {Map<number, Map<number, object>>} */
const buckets = new Map();

const getBucket = (convoyId) => {
    let b = buckets.get(convoyId);
    if (!b) {
        b = new Map();
        buckets.set(convoyId, b);
    }
    return b;
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
    return { deltaKm, distance_km, row };
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

export const clearConvoyLocationBucket = (convoyId) => {
    buckets.delete(convoyId);
};
