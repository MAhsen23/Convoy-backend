import * as userModel from '../models/userModel.js';
import * as socialModel from '../models/socialModel.js';

const toPublicUser = (u) => ({
    id: u.id,
    unique_id: u.unique_id,
    username: u.username,
    profile_picture_url: u.profile_picture_url,
    status: u.status
});

export const searchUsers = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const limit = parseInt(req.query.limit || '20', 10);
        if (!q) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Query parameter "q" is required',
                data: null
            });
        }

        const users = await socialModel.searchUsers(q, req.user.id, limit);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { users }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to search users',
            data: null
        });
    }
};

export const getSuggestedUsers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '4', 10);

        const users = await socialModel.getSuggestedUsers(req.user.id, limit);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { users }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to get suggested users',
            data: null
        });
    }
};

const resolveTargetUser = async (body) => {
    if (body.to_user_id !== undefined) {
        return await userModel.getUserById(parseInt(body.to_user_id, 10));
    }
    if (body.to_unique_id !== undefined) {
        return await userModel.getByUniqueId(body.to_unique_id);
    }
    if (body.to_username !== undefined) {
        return await userModel.getByUsername(body.to_username);
    }
    return null;
};

export const sendFriendRequest = async (req, res) => {
    try {
        const target = await resolveTargetUser(req.body);
        if (!target) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Provide a valid target: to_user_id, to_unique_id, or to_username',
                data: null
            });
        }
        if (target.id === req.user.id) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'You cannot send a friend request to yourself',
                data: null
            });
        }

        const alreadyFriends = await socialModel.areFriends(req.user.id, target.id);
        if (alreadyFriends) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'You are already friends',
                data: null
            });
        }

        const outgoingPending = await socialModel.getPendingRequest(req.user.id, target.id);
        if (outgoingPending) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Friend request already sent',
                data: null
            });
        }

        const incomingPending = await socialModel.getPendingRequest(target.id, req.user.id);
        if (incomingPending) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'This user already sent you a friend request. Accept it from pending requests.',
                data: null
            });
        }

        const request = await socialModel.createFriendRequest(req.user.id, target.id);
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Friend request sent',
            data: { request }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to send friend request',
            data: null
        });
    }
};

export const listPendingRequests = async (req, res) => {
    try {
        const requests = await socialModel.listPendingReceived(req.user.id);
        const senderIds = requests.map(r => r.sender_id);
        const users = await socialModel.getUsersByIds(senderIds);
        const userMap = new Map(users.map(u => [u.id, toPublicUser(u)]));

        const enriched = requests.map(r => ({
            ...r,
            sender: userMap.get(r.sender_id) || null
        }));

        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { requests: enriched }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list pending requests',
            data: null
        });
    }
};

export const respondFriendRequest = async (req, res) => {
    try {
        const action = String(req.body.action || '').toLowerCase();
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Action must be "accept" or "reject"',
                data: null
            });
        }

        const status = action === 'accept' ? 'accepted' : 'rejected';
        const request = await socialModel.updateFriendRequestStatus(
            parseInt(req.params.id, 10),
            req.user.id,
            status
        );

        if (!request) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'Pending request not found',
                data: null
            });
        }

        if (action === 'accept') {
            await socialModel.ensureFriendship(request.sender_id, request.receiver_id);
        }

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: action === 'accept' ? 'Friend request accepted' : 'Friend request rejected',
            data: { request }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to respond to request',
            data: null
        });
    }
};

export const listFriends = async (req, res) => {
    try {
        const friendships = await socialModel.listFriendships(req.user.id);
        const friendIds = friendships.map(f => (f.user_one_id === req.user.id ? f.user_two_id : f.user_one_id));
        const users = await socialModel.getUsersByIds(friendIds);

        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { friends: users.map(toPublicUser) }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to list friends',
            data: null
        });
    }
};

export const removeFriend = async (req, res) => {
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

        await socialModel.removeFriendship(req.user.id, otherUserId);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Friend removed',
            data: null
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to remove friend',
            data: null
        });
    }
};
