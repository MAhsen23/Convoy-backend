import * as userModel from '../models/userModel.js';
import * as socialModel from '../models/socialModel.js';
import * as chatModel from '../models/chatModel.js';
import { emitToConversationExceptUsers, emitToUsers } from '../socket/io.js';

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
        const userId = req.user.id;

        const toUserId = req.body?.to_user_id
            ? parseInt(req.body.to_user_id, 10)
            : null;

        const type = String(req.body.type || "text");
        const content = String(req.body.content || "").trim();
        const metadata = req.body.metadata || null;

        let conversation = null;
        if (!content) {
            return res.status(400).json({
                success: false,
                status: "ERROR",
                message: "Message content is required",
                data: null
            });
        }

        const allowedTypes = ["text", "image", "system"];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                status: "ERROR",
                message: "type must be one of: text, image, system",
                data: null
            });
        }

        if (!toUserId) {
            return res.status(400).json({
                success: false,
                status: "ERROR",
                message: "Recipient user Id is required",
                data: null
            });
        }

        if (toUserId === userId) {
            return res.status(400).json({
                success: false,
                status: "ERROR",
                message: "Cannot send message to yourself",
                data: null
            });
        }

        const otherUser = await userModel.getUserById(toUserId);

        if (!otherUser) {
            return res.status(404).json({
                success: false,
                status: "ERROR",
                message: "User not found",
                data: null
            });
        }

        const areFriends = await socialModel.areFriends(userId, toUserId);

        if (!areFriends) {
            return res.status(403).json({
                success: false,
                status: "ERROR",
                message: "You can only chat with friends",
                data: null
            });
        }

        conversation = await chatModel.getOrCreateDirectConversation(userId, toUserId);
        const conversationId = conversation.id;

        const message = await chatModel.createMessage(
            conversationId,
            userId,
            content,
            type,
            metadata
        );
        if (conversation) {
            conversation = {
                ...conversation,
                latest_message: message.content,
                latest_message_at: message.created_at
            };
        }
        let participantUserIds = await chatModel.listConversationMemberUserIds(conversationId);
        participantUserIds = participantUserIds.filter((id) => id !== userId);

        emitToConversationExceptUsers(conversationId, [userId], "conversation:message_new", {
            conversation_id: conversationId,
            message
        });

        emitToUsers(participantUserIds, 'inbox:conversation_updated', {
            conversation_id: conversationId,
            actor_user_id: userId,
            latest_message: message.content,
            latest_message_at: message.created_at,
        });

        return res.status(201).json({
            success: true,
            status: "OK",
            message: "Message sent",
            data: {
                ...(conversation && { conversation }),
                message
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: "ERROR",
            message: err.message || "Failed to send message",
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
        emitToConversationExceptUsers(conversationId, [req.user.id], 'conversation:read', {
            conversation_id: conversationId,
            user_id: req.user.id,
            last_read_at: state.last_read_at
        });
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
