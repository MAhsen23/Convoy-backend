import * as userModel from '../models/userModel.js';
import * as convoyModel from '../models/convoyModel.js';
import * as chatModel from '../models/chatModel.js';
import config from '../config/config.js';
import { generateRtcTokenForUid } from '../utils/agoraToken.js';
import { emitToConvoyExceptUsers, emitToUser, emitToUsers } from '../socket/io.js';

const convoySummary = (c) =>
    c
        ? {
            id: c.id,
            code: c.code,
            name: c.name,
            icon: c.icon || null,
            created_by: c.created_by,
            status: c.status,
            max_members: c.max_members,
            started_at: c.started_at,
            ended_at: c.ended_at,
            created_at: c.created_at
        }
        : null;

export const createConvoy = async (req, res) => {
    try {
        /*
        const existing = await convoyModel.getActiveConvoyForUser(req.user.id);
        if (existing) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'You are already in an active convoy',
                data: { convoy: convoySummary(existing) }
            });
        }
        */

        const max_members = req.body.max_members ? parseInt(req.body.max_members, 10) : 15;
        if (!Number.isInteger(max_members) || max_members < 2 || max_members > 50) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'max_members must be an integer between 2 and 50',
                data: null
            });
        }

        const icon = req.body.icon ? String(req.body.icon).trim() : null;
        if (icon && icon.length > 100) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'icon must be at most 100 characters',
                data: null
            });
        }

        const convoy = await convoyModel.createConvoy({
            created_by: req.user.id,
            name: req.body.name,
            icon,
            max_members
        });
        const convoyWithConversationId = {
            ...convoySummary(convoy),
            conversation_id: convoy.conversation_id ?? null
        };
        emitToUser(req.user.id, 'convoy:created', {
            convoy: convoyWithConversationId
        });
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Convoy created',
            data: { convoy: convoyWithConversationId }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to create convoy',
            data: null
        });
    }
};

export const getCurrentConvoy = async (req, res) => {
    try {
        const convoy = await convoyModel.getActiveConvoyForUser(req.user.id);
        let convoyData = convoySummary(convoy);
        if (convoy) {
            const activeMemberCount = await convoyModel.countActiveMembers(convoy.id);
            const convoyConversation = await convoyModel.getConvoyConversationByConvoyId(convoy.id);
            convoyData = {
                ...convoyData,
                active_member_count: activeMemberCount,
                is_leader: convoy.created_by === req.user.id,
                conversation_id: convoyConversation?.id ?? null
            };
        }
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { convoy: convoyData }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to get current convoy',
            data: null
        });
    }
};

export const joinByCode = async (req, res) => {
    try {
        const code = String(req.body.code || '').trim().toUpperCase();
        if (!code) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'code is required',
                data: null
            });
        }

        const active = await convoyModel.getActiveConvoyForUser(req.user.id);
        if (active) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'You are already in an active convoy',
                data: { convoy: convoySummary(active) }
            });
        }

        const convoy = await convoyModel.getConvoyByCode(code);
        if (!convoy) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Active convoy not found for this code',
                data: null
            });
        }

        const count = await convoyModel.countActiveMembers(convoy.id);
        if (count >= convoy.max_members) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Convoy is full',
                data: null
            });
        }

        await convoyModel.addMember(convoy.id, req.user.id, 'member');
        const otherMemberUserIds = (await convoyModel.listActiveMemberUserIds(convoy.id))
            .filter((id) => id !== req.user.id);
        emitToUsers(otherMemberUserIds, 'convoy:member_joined', {
            convoy_id: convoy.id,
            user: {
                id: req.user.id,
                username: req.user.username,
                profile_picture_url: req.user.profile_picture_url
            }
        });
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Joined convoy',
            data: { convoy: convoySummary(convoy) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to join convoy',
            data: null
        });
    }
};

export const leaveConvoy = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        const member = await convoyModel.getMember(convoyId, req.user.id);
        if (!member) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'You are not an active member of this convoy',
                data: null
            });
        }
        if (member.role === 'leader') {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Leader cannot leave directly. End convoy instead.',
                data: null
            });
        }
        await convoyModel.leaveConvoy(convoyId, req.user.id);
        const otherMemberUserIds = (await convoyModel.listActiveMemberUserIds(convoyId))
            .filter((id) => id !== req.user.id);
        emitToUsers(otherMemberUserIds, 'convoy:member_left', {
            convoy_id: convoyId,
            user: {
                id: req.user.id,
                username: req.user.username
            }
        });
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Left convoy',
            data: null
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to leave convoy',
            data: null
        });
    }
};

export const endConvoy = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        const member = await convoyModel.getMember(convoyId, req.user.id);
        if (!member || member.role !== 'leader') {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'Only convoy leader can end convoy',
                data: null
            });
        }
        const convoy = await convoyModel.endConvoy(convoyId);
        emitToConvoyExceptUsers(convoyId, [req.user.id], 'convoy:ended', {
            convoy_id: convoyId,
            ended_by: req.user.id,
            ended_at: convoy?.ended_at || new Date().toISOString()
        });
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Convoy ended',
            data: { convoy: convoySummary(convoy) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to end convoy',
            data: null
        });
    }
};

export const updateConvoyStatus = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        if (!Number.isInteger(convoyId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid convoy id',
                data: null
            });
        }

        const convoy = await convoyModel.getConvoyById(convoyId);
        if (!convoy) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Convoy not found',
                data: null
            });
        }

        if (convoy.created_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'Only convoy leader can update convoy status',
                data: null
            });
        }

        const action = String(req.body?.action || '').trim().toLowerCase();
        const status = String(req.body?.status || '').trim().toLowerCase();
        let targetStatus = null;

        if (action === 'start') targetStatus = 'started';
        if (action === 'end') targetStatus = 'ended';
        if (status === 'started' || status === 'ended') targetStatus = status;

        if (!targetStatus) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Provide action=start|end or status=started|ended',
                data: null
            });
        }

        if (targetStatus === convoy.status) {
            return res.status(200).json({
                success: true,
                status: 'OK',
                message: `Convoy is already ${targetStatus}`,
                data: { convoy: convoySummary(convoy) }
            });
        }

        if (targetStatus === 'ended') {
            const ended = await convoyModel.endConvoy(convoyId);
            const otherMemberUserIds = (await convoyModel.listActiveMemberUserIds(convoyId))
                .filter((id) => id !== req.user.id);
            emitToUsers(otherMemberUserIds, 'convoy:ended', {
                convoy_id: convoyId,
                ended_by: req.user.id,
                ended_at: ended?.ended_at || new Date().toISOString()
            });
            return res.status(200).json({
                success: true,
                status: 'OK',
                message: 'Convoy ended',
                data: { convoy: convoySummary(ended) }
            });
        }

        if (convoy.status !== 'active') {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Only active convoy can be started',
                data: { convoy: convoySummary(convoy) }
            });
        }

        if (targetStatus === 'started') {
            const count = await convoyModel.countActiveMembers(convoyId);
            if (count < 2) {
                return res.status(409).json({
                    success: false,
                    status: 'ERROR',
                    message: 'At least 2 active members are required to start convoy',
                    data: { convoy: convoySummary(convoy), active_member_count: count }
                });
            }
        }

        const started = await convoyModel.startConvoy(convoyId);
        if (!started) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Convoy could not be started',
                data: { convoy: convoySummary(convoy) }
            });
        }
        const otherMemberUserIds = (await convoyModel.listActiveMemberUserIds(convoyId))
            .filter((id) => id !== req.user.id);
        emitToUsers(otherMemberUserIds, 'convoy:started', {
            convoy_id: convoyId,
            started_by: req.user.id,
            started_at: started?.started_at || new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Convoy started',
            data: { convoy: convoySummary(started) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to update convoy status',
            data: null
        });
    }
};

export const listMembers = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        const member = await convoyModel.getMember(convoyId, req.user.id);
        if (!member) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You are not an active member of this convoy',
                data: null
            });
        }

        const members = await convoyModel.listMembers(convoyId);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { members }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list convoy members',
            data: null
        });
    }
};

export const sendInvite = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        const inviteeUserId = parseInt(req.body.invitee_user_id, 10);
        if (!Number.isInteger(inviteeUserId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'invitee_user_id is required',
                data: null
            });
        }
        if (inviteeUserId === req.user.id) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Cannot invite yourself',
                data: null
            });
        }

        const convoy = await convoyModel.getConvoyById(convoyId);
        if (!convoy || convoy.status !== 'active') {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Active convoy not found',
                data: null
            });
        }

        const inviterMember = await convoyModel.getMember(convoyId, req.user.id);
        if (!inviterMember) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'Only active convoy members can invite',
                data: null
            });
        }

        const invitee = await userModel.getUserById(inviteeUserId);
        if (!invitee) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Invitee user not found',
                data: null
            });
        }

        const alreadyInConvoy = await convoyModel.getMember(convoyId, inviteeUserId);
        if (alreadyInConvoy) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'User is already in convoy',
                data: null
            });
        }

        const invite = await convoyModel.createInvite(convoyId, req.user.id, inviteeUserId);
        emitToUser(inviteeUserId, 'convoy:invite_new', {
            invite
        });
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Convoy invite sent',
            data: { invite }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to send convoy invite',
            data: null
        });
    }
};

export const listPendingInvites = async (req, res) => {
    try {
        const invites = await convoyModel.listPendingInvites(req.user.id);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { invites }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list invites',
            data: null
        });
    }
};

export const respondInvite = async (req, res) => {
    try {
        const inviteId = parseInt(req.params.id, 10);
        const action = String(req.body.action || '').toLowerCase();
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'action must be accept or reject',
                data: null
            });
        }

        const invite = await convoyModel.getInviteByIdForUser(inviteId, req.user.id);
        if (!invite) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Pending invite not found',
                data: null
            });
        }

        if (action === 'reject') {
            await convoyModel.respondInvite(inviteId, req.user.id, 'rejected');
            emitToUser(invite.inviter_id, 'convoy:invite_rejected', {
                invite_id: invite.id,
                convoy_id: invite.convoy_id,
                invitee_id: req.user.id
            });
            return res.status(200).json({
                success: true,
                status: 'OK',
                message: 'Invite rejected',
                data: null
            });
        }

        const active = await convoyModel.getActiveConvoyForUser(req.user.id);
        if (active) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Leave current convoy before accepting another invite',
                data: { convoy: convoySummary(active) }
            });
        }

        const convoy = await convoyModel.getConvoyById(invite.convoy_id);
        if (!convoy || convoy.status !== 'active') {
            await convoyModel.respondInvite(inviteId, req.user.id, 'cancelled');
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Convoy is no longer active',
                data: null
            });
        }

        const count = await convoyModel.countActiveMembers(convoy.id);
        if (count >= convoy.max_members) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Convoy is full',
                data: null
            });
        }

        await convoyModel.respondInvite(inviteId, req.user.id, 'accepted');
        await convoyModel.addMember(convoy.id, req.user.id, 'member');
        emitToUser(invite.inviter_id, 'convoy:invite_accepted', {
            invite_id: invite.id,
            convoy_id: convoy.id,
            invitee_id: req.user.id
        });
        const otherMemberUserIds = (await convoyModel.listActiveMemberUserIds(convoy.id))
            .filter((id) => id !== req.user.id);
        emitToUsers(otherMemberUserIds, 'convoy:member_joined', {
            convoy_id: convoy.id,
            user: {
                id: req.user.id,
                username: req.user.username,
                profile_picture_url: req.user.profile_picture_url
            }
        });

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Joined convoy via invite',
            data: { convoy: convoySummary(convoy) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to respond to invite',
            data: null
        });
    }
};

export const sendConvoyMessage = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        const conversationId = req.body?.conversation_id
            ? parseInt(req.body.conversation_id, 10)
            : null;

        if (!Number.isInteger(convoyId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid convoy id',
                data: null
            });
        }
        if (!Number.isInteger(conversationId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'conversation_id is required',
                data: null
            });
        }

        const member = await convoyModel.getMember(convoyId, req.user.id);
        if (!member) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You are not an active member of this convoy',
                data: null
            });
        }

        const type = String(req.body.type || 'text');
        const content = String(req.body.content || '').trim();
        const metadata = req.body.metadata || null;
        const allowedTypes = ['text', 'image', 'system'];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'type must be one of: text, image, system',
                data: null
            });
        }
        if (!content) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Message content is required',
                data: null
            });
        }

        const convoyConversation = await convoyModel.getConvoyConversationById(conversationId);
        if (!convoyConversation) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'conversation_id must reference a convoy conversation',
                data: null
            });
        }
        if (convoyConversation.convoy_id !== convoyId) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'conversation_id does not belong to provided convoy id',
                data: null
            });
        }

        const message = await convoyModel.createConvoyMessageByConversationId(
            convoyConversation.id,
            req.user.id,
            content,
            type,
            metadata
        );

        emitToConvoyExceptUsers(convoyId, [req.user.id], 'convoy:message_new', {
            convoy_id: convoyId,
            message
        });
        const recipientUserIds = (await chatModel.listConversationMemberUserIds(convoyConversation.id))
            .filter((id) => id !== req.user.id);
        emitToUsers(recipientUserIds, 'inbox:conversation_updated', {
            conversation_id: convoyConversation.id,
            actor_user_id: req.user.id,
            latest_message: message.content,
            latest_message_at: message.created_at,
        });

        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Convoy message sent',
            data: { message }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to send convoy message',
            data: null
        });
    }
};

export const listConvoyMessages = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        if (!Number.isInteger(convoyId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid convoy id',
                data: null
            });
        }

        const limit = parseInt(req.query.limit || '50', 10);
        const offset = parseInt(req.query.offset || '0', 10);
        const result = await convoyModel.listConvoyMessages(convoyId, limit, offset);

        return res.status(200).json({
            success: true,
            status: 'OK',
            data: {
                messages: result.messages,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.offset + result.limit < result.total
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list convoy messages',
            data: null
        });
    }
};

export const generateConvoyVoiceToken = async (req, res) => {
    try {
        const convoyId = parseInt(req.params.id, 10);
        if (!Number.isInteger(convoyId)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid convoy id',
                data: null
            });
        }

        const convoy = await convoyModel.getConvoyById(convoyId);
        if (!convoy) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Convoy not found',
                data: null
            });
        }

        if (!['started'].includes(String(convoy.status || '').toLowerCase())) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Voice call is only available for active or started convoy',
                data: null
            });
        }

        const member = await convoyModel.getMember(convoyId, req.user.id);
        if (!member) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'You are not an active member of this convoy',
                data: null
            });
        }

        if (!config.agora.appId || !config.agora.appCertificate) {
            return res.status(500).json({
                success: false,
                status: 'ERROR',
                message: 'Agora is not configured on server',
                data: null
            });
        }

        const requestedRole = String(req.body?.role || 'publisher').trim().toLowerCase();
        if (!['publisher', 'subscriber'].includes(requestedRole)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'role must be publisher or subscriber',
                data: null
            });
        }

        const requestedExpiry = req.body?.expiry_seconds
            ? parseInt(req.body.expiry_seconds, 10)
            : config.agora.tokenExpirySeconds;

        const channelName = `convoy_${convoyId}`;
        const tokenData = generateRtcTokenForUid({
            appId: config.agora.appId,
            appCertificate: config.agora.appCertificate,
            channelName,
            uid: req.user.id,
            role: requestedRole,
            expirySeconds: requestedExpiry
        });

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Convoy voice token generated',
            data: {
                app_id: config.agora.appId,
                channel_name: channelName,
                convoy_id: convoyId,
                ...tokenData
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to generate convoy voice token',
            data: null
        });
    }
};
