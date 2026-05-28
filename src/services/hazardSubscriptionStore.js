/** In-memory map viewport subscriptions per socket (single-server MVP). */

/** @type {Map<string, { userId: number, min_lat: number, max_lat: number, min_lng: number, max_lng: number }>} */
const subscriptions = new Map();

export const setSubscription = (socketId, userId, bbox) => {
    subscriptions.set(socketId, { userId, ...bbox });
};

export const clearSubscription = (socketId) => {
    subscriptions.delete(socketId);
};

const pointInBbox = (lat, lng, bbox) =>
    lat >= bbox.min_lat &&
    lat <= bbox.max_lat &&
    lng >= bbox.min_lng &&
    lng <= bbox.max_lng;

/**
 * @param {{ lat: number, lng: number }} point
 * @param {number|null} excludeUserId
 * @returns {number[]} socket ids to notify
 */
export const getSocketIdsForPoint = (point, excludeUserId = null) => {
    const out = [];
    for (const [socketId, sub] of subscriptions.entries()) {
        if (excludeUserId != null && sub.userId === excludeUserId) continue;
        if (pointInBbox(point.lat, point.lng, sub)) out.push(socketId);
    }
    return out;
};
