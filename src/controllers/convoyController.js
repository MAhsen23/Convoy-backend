import * as userModel from '../models/userModel.js';
import * as convoyModel from '../models/convoyModel.js';

const convoySummary = (c) =>
    c
        ? {
            id: c.id,
            code: c.code,
            name: c.name,
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
        const existing = await convoyModel.getActiveConvoyForUser(req.user.id);
        if (existing) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'You are already in an active convoy',
                data: { convoy: convoySummary(existing) }
            });
        }

        const max_members = req.body.max_members ? parseInt(req.body.max_members, 10) : 15;
        if (!Number.isInteger(max_members) || max_members < 2 || max_members > 50) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'max_members must be an integer between 2 and 50',
                data: null
            });
        }

        const convoy = await convoyModel.createConvoy({
            created_by: req.user.id,
            name: req.body.name,
            max_members
        });
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Convoy created',
            data: { convoy: convoySummary(convoy) }
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
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { convoy: convoySummary(convoy) }
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
