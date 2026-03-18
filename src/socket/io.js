import { Server } from 'socket.io';
import db from '../config/db.js';
import config from '../config/config.js';
import { verifyToken } from '../utils/jwt.js';
import { getUserById } from '../models/userModel.js';
import { createSocketEventLog } from '../models/socketEventLogModel.js';

let ioInstance = null;

const roomUser = (userId) => `user:${userId}`;
const roomConversation = (conversationId) => `conversation:${conversationId}`;
const roomConvoy = (convoyId) => `convoy:${convoyId}`;

const sanitizeSocketPayload = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    const hiddenFields = ['password', 'password_hash', 'token', 'secret', 'api_key', 'authorization'];

    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeSocketPayload(entry));
    }

    const result = {};
    Object.keys(value).forEach((key) => {
        if (hiddenFields.includes(key.toLowerCase())) {
            result[key] = '***REDACTED***';
            return;
        }
        result[key] = sanitizeSocketPayload(value[key]);
    });

    return result;
};

const queueSocketLog = (payload = {}) => {
    if (!config.logToDatabase) return;

    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    void createSocketEventLog({
        event_id: eventId,
        ...payload,
        payload: sanitizeSocketPayload(payload.payload)
    });
};

const getHandshakeToken = (socket) => {
    const authToken = socket.handshake?.auth?.token;
    if (authToken) return String(authToken).replace(/^Bearer\s+/i, '');

    const headerToken = socket.handshake?.headers?.authorization;
    if (headerToken) return String(headerToken).replace(/^Bearer\s+/i, '');

    return null;
};

const joinDefaultRooms = async (socket, userId) => {
    socket.join(roomUser(userId));
};

export const initSocket = (httpServer) => {
    if (ioInstance) return ioInstance;

    ioInstance = new Server(httpServer, {
        maxHttpBufferSize: Number(process.env.SOCKET_MAX_HTTP_BUFFER_SIZE || 1e6),
        cors: {
            origin: config.socket.corsOrigins,
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
            credentials: true
        }
    });

    ioInstance.use(async (socket, next) => {
        try {
            const token = getHandshakeToken(socket);
            if (!token) return next(new Error('Authentication token required'));

            const decoded = verifyToken(token);
            const user = await getUserById(decoded.id);
            if (!user || !user.is_active) return next(new Error('Unauthorized'));

            socket.user = user;
            return next();
        } catch (err) {
            return next(new Error('Invalid authentication token'));
        }
    });

    ioInstance.on('connection', async (socket) => {
        const userId = socket.user.id;
        await joinDefaultRooms(socket, userId);
        queueSocketLog({
            direction: 'system',
            event_name: 'socket:connected',
            socket_id: socket.id,
            user_id: userId,
            status: 'OK',
            payload: { connected_at: new Date().toISOString() }
        });

        socket.onAny((eventName, ...args) => {
            const payload = args.length === 1 ? args[0] : { args };
            queueSocketLog({
                direction: 'incoming',
                event_name: eventName,
                socket_id: socket.id,
                user_id: userId,
                status: 'OK',
                conversation_id: Number.isInteger(parseInt(payload?.conversation_id, 10))
                    ? parseInt(payload.conversation_id, 10)
                    : null,
                convoy_id: Number.isInteger(parseInt(payload?.convoy_id, 10))
                    ? parseInt(payload.convoy_id, 10)
                    : null,
                payload
            });
        });

        socket.on('conversation:join', async (payload = {}) => {
            const conversationId = parseInt(payload.conversation_id, 10);
            if (!Number.isInteger(conversationId)) return;

            const { data } = await db
                .from('conversation_members')
                .select('id')
                .eq('conversation_id', conversationId)
                .eq('user_id', userId)
                .maybeSingle();
            if (!data) return;

            socket.join(roomConversation(conversationId));
        });

        socket.on('conversation:leave', (payload = {}) => {
            const conversationId = parseInt(payload.conversation_id, 10);
            if (!Number.isInteger(conversationId)) return;
            socket.leave(roomConversation(conversationId));
        });

        socket.on('conversation:typing', (payload = {}) => {
            const conversationId = parseInt(payload.conversation_id, 10);
            if (!Number.isInteger(conversationId)) return;
            socket.to(roomConversation(conversationId)).emit('conversation:typing', {
                conversation_id: conversationId,
                user: {
                    id: socket.user.id,
                    username: socket.user.username
                },
                is_typing: Boolean(payload.is_typing),
                timestamp: Date.now()
            });
        });

        socket.on('convoy:join_room', async (payload = {}) => {
            const convoyId = parseInt(payload.convoy_id, 10);
            if (!Number.isInteger(convoyId)) return;

            const { data } = await db
                .from('convoy_members')
                .select('id')
                .eq('convoy_id', convoyId)
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle();
            if (!data) return;

            socket.join(roomConvoy(convoyId));
        });

        socket.on('convoy:leave_room', (payload = {}) => {
            const convoyId = parseInt(payload.convoy_id, 10);
            if (!Number.isInteger(convoyId)) return;
            socket.leave(roomConvoy(convoyId));
        });

        socket.on('disconnect', (reason) => {
            queueSocketLog({
                direction: 'system',
                event_name: 'socket:disconnected',
                socket_id: socket.id,
                user_id: userId,
                status: 'OK',
                payload: { reason, disconnected_at: new Date().toISOString() }
            });
        });
    });

    return ioInstance;
};

export const getIO = () => ioInstance;

export const emitToUser = (userId, event, payload) => {
    if (!ioInstance) return;
    ioInstance.to(roomUser(userId)).emit(event, payload);
    queueSocketLog({
        direction: 'outgoing',
        event_name: event,
        user_id: userId,
        room: roomUser(userId),
        target_user_ids: [userId],
        status: 'OK',
        conversation_id: Number.isInteger(parseInt(payload?.conversation_id, 10))
            ? parseInt(payload.conversation_id, 10)
            : null,
        convoy_id: Number.isInteger(parseInt(payload?.convoy_id, 10))
            ? parseInt(payload.convoy_id, 10)
            : null,
        payload
    });
};

export const emitToUsers = (userIds, event, payload) => {
    if (!ioInstance) return;
    const targets = [...new Set(userIds || [])];
    targets.forEach((id) => ioInstance.to(roomUser(id)).emit(event, payload));
    queueSocketLog({
        direction: 'outgoing',
        event_name: event,
        target_user_ids: targets,
        room: targets.length === 1 ? roomUser(targets[0]) : null,
        status: 'OK',
        conversation_id: Number.isInteger(parseInt(payload?.conversation_id, 10))
            ? parseInt(payload.conversation_id, 10)
            : null,
        convoy_id: Number.isInteger(parseInt(payload?.convoy_id, 10))
            ? parseInt(payload.convoy_id, 10)
            : null,
        payload
    });
};

export const emitToConversation = (conversationId, event, payload) => {
    if (!ioInstance) return;
    ioInstance.to(roomConversation(conversationId)).emit(event, payload);
    queueSocketLog({
        direction: 'outgoing',
        event_name: event,
        room: roomConversation(conversationId),
        conversation_id: conversationId,
        status: 'OK',
        payload
    });
};

export const emitToConversationExceptUsers = (
    conversationId,
    excludedUserIds = [],
    event,
    payload
) => {
    if (!ioInstance) return;

    const room = roomConversation(conversationId);
    const excludedRooms = [...new Set(excludedUserIds)]
        .filter((id) => Number.isInteger(id))
        .map((id) => roomUser(id));

    ioInstance.to(room).except(excludedRooms).emit(event, payload);
    queueSocketLog({
        direction: 'outgoing',
        event_name: event,
        room,
        conversation_id: conversationId,
        status: 'OK',
        payload: {
            ...payload,
            __excluded_user_ids: excludedUserIds
        }
    });
};

export const emitToConvoy = (convoyId, event, payload) => {
    if (!ioInstance) return;
    ioInstance.to(roomConvoy(convoyId)).emit(event, payload);
    queueSocketLog({
        direction: 'outgoing',
        event_name: event,
        room: roomConvoy(convoyId),
        convoy_id: convoyId,
        status: 'OK',
        payload
    });
};

export const emitToConvoyExceptUsers = (
    convoyId,
    excludedUserIds = [],
    event,
    payload
) => {
    if (!ioInstance) return;

    const room = roomConvoy(convoyId);

    const excludedRooms = [...new Set(excludedUserIds)]
        .filter((id) => Number.isInteger(id))
        .map((id) => roomUser(id));

    ioInstance.to(room).except(excludedRooms).emit(event, payload);
    queueSocketLog({
        direction: 'outgoing',
        event_name: event,
        room,
        convoy_id: convoyId,
        status: 'OK',
        payload: {
            ...payload,
            __excluded_user_ids: excludedUserIds
        }
    });
};

export const socketRooms = {
    roomUser,
    roomConversation,
    roomConvoy
};
