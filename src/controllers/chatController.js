import * as userModel from '../models/userModel.js';
import * as socialModel from '../models/socialModel.js';
import * as chatModel from '../models/chatModel.js';

export const createOrGetDirectConversation = async (req, res) => {
    try {
        const otherUserId = parseInt(req.params.userId, 10);
        if (!Number.isInteger(otherUserId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid user id',
                data: null
            });
        }
        if (otherUserId === req.user.id) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Cannot create direct conversation with yourself',
                data: null
            });
        }

        const otherUser = await userModel.getUserById(otherUserId);
        if (!otherUser) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'User not found',
                data: null
            });
        }

        const friends = await socialModel.areFriends(req.user.id, otherUserId);
        if (!friends) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You can only chat with friends',
                data: null
            });
        }

        const conversation = await chatModel.getOrCreateDirectConversation(req.user.id, otherUserId);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { conversation }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to open direct conversation',
            data: null
        });
    }
};

export const listConversations = async (req, res) => {
    try {
        const conversations = await chatModel.listUserConversations(req.user.id);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { conversations }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list conversations',
            data: null
        });
    }
};

export const listMessages = async (req, res) => {
    try {
        const conversationId = parseInt(req.params.id, 10);
        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);

        const isMember = await chatModel.isConversationMember(conversationId, req.user.id);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You are not a member of this conversation',
                data: null
            });
        }

        const messages = await chatModel.listConversationMessages(conversationId, limit, offset);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { messages }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list messages',
            data: null
        });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const conversationId = parseInt(req.params.id, 10);
        const type = String(req.body.type || 'text');
        const content = String(req.body.content || '').trim();
        const metadata = req.body.metadata || null;

        if (!content) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Message content is required',
                data: null
            });
        }
        if (!['text', 'image', 'system'].includes(type)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'type must be one of: text, image, system',
                data: null
            });
        }

        const isMember = await chatModel.isConversationMember(conversationId, req.user.id);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You are not a member of this conversation',
                data: null
            });
        }

        const message = await chatModel.createMessage(conversationId, req.user.id, content, type, metadata);
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Message sent',
            data: { message }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to send message',
            data: null
        });
    }
};

export const markRead = async (req, res) => {
    try {
        const conversationId = parseInt(req.params.id, 10);
        const isMember = await chatModel.isConversationMember(conversationId, req.user.id);
        if (!isMember) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You are not a member of this conversation',
                data: null
            });
        }
        const state = await chatModel.markConversationRead(conversationId, req.user.id);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { read_state: state }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to mark conversation read',
            data: null
        });
    }
};
