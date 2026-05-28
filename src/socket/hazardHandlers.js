import { parseBbox } from '../services/hazardService.js';
import {
    setSubscription,
    clearSubscription
} from '../services/hazardSubscriptionStore.js';

export const registerHazardSocketHandlers = (socket) => {
    const userId = socket.user.id;

    socket.on('hazard:subscribe', (payload = {}) => {
        const parsed = parseBbox({
            min_lat: payload.min_lat,
            max_lat: payload.max_lat,
            min_lng: payload.min_lng,
            max_lng: payload.max_lng
        });
        if (parsed.error) {
            socket.emit('hazard:subscribe_error', { message: parsed.error });
            return;
        }
        setSubscription(socket.id, userId, parsed.bbox);
        socket.emit('hazard:subscribed', { bbox: parsed.bbox });
    });

    socket.on('hazard:unsubscribe', () => {
        clearSubscription(socket.id);
        socket.emit('hazard:unsubscribed', {});
    });
};

export const onHazardSocketDisconnect = (socketId) => {
    clearSubscription(socketId);
};
