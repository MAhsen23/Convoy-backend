import { Server } from 'socket.io';
import db from '../config/db.js';
import config from '../config/config.js';
import { verifyToken } from '../utils/jwt.js';
import { getUserById } from '../models/userModel.js';

let ioInstance = null;

const roomUser = (userId) => `user:${userId}`;
const roomConversation = (conversationId) => `conversation:${conversationId}`;
const roomConvoy = (convoyId) => `convoy:${convoyId}`;

const getHandshakeToken = (socket) => {
    const authToken = socket.handshake?.auth?.token;
    if (authToken) return String(authToken).replace(/^Bearer\s+/i, '');

    const headerToken = socket.handshake?.headers?.authorization;
    if (headerToken) return String(headerToken).replace(/^Bearer\s+/i, '');

    return null;
};

const joinDefaultRooms = async (socket, userId) => {
    socket.join(roomUser(userId));

    const { data: memberships } = await db
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);
    (memberships || []).forEach((m) => socket.join(roomConversation(m.conversation_id)));

    const { data: convoyMemberships } = await db
        .from('convoy_members')
        .select('convoy_id')
        .eq('user_id', userId)
        .eq('status', 'active');
    (convoyMemberships || []).forEach((m) => socket.join(roomConvoy(m.convoy_id)));
};

export const initSocket = (httpServer) => {
    if (ioInstance) return ioInstance;

    ioInstance = new Server(httpServer, {
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
    });

    return ioInstance;
};

export const getIO = () => ioInstance;

export const emitToUser = (userId, event, payload) => {
    if (!ioInstance) return;
    ioInstance.to(roomUser(userId)).emit(event, payload);
};

export const emitToUsers = (userIds, event, payload) => {
    if (!ioInstance) return;
    [...new Set(userIds || [])].forEach((id) => ioInstance.to(roomUser(id)).emit(event, payload));
};

export const emitToConversation = (conversationId, event, payload) => {
    if (!ioInstance) return;
    ioInstance.to(roomConversation(conversationId)).emit(event, payload);
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
};

export const emitToConvoy = (convoyId, event, payload) => {
    if (!ioInstance) return;
    ioInstance.to(roomConvoy(convoyId)).emit(event, payload);
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
};

export const socketRooms = {
    roomUser,
    roomConversation,
    roomConvoy
};
