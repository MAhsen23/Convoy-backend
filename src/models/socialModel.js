import db from '../config/db.js';

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

export const searchUsers = async (query, currentUserId, limit = 20) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];

    const numeric = parseInt(q, 10);
    let builder = db
        .from('users')
        .select('id, unique_id, username, profile_picture_url, status')
        .neq('id', currentUserId)
        .limit(limit);

    if (Number.isInteger(numeric) && numeric >= 1000000 && numeric <= 9999999) {
        builder = builder.or(`unique_id.eq.${numeric},username_normalized.ilike.%${q}%`);
    } else {
        builder = builder.ilike('username_normalized', `%${q}%`);
    }

    const { data, error } = await builder.order('username', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

export const areFriends = async (userAId, userBId) => {
    const [user_one_id, user_two_id] = pair(userAId, userBId);
    const { data, error } = await db
        .from('friendships')
        .select('id')
        .eq('user_one_id', user_one_id)
        .eq('user_two_id', user_two_id)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return Boolean(data);
};

export const getPendingRequest = async (senderId, receiverId) => {
    const { data, error } = await db
        .from('friend_requests')
        .select('*')
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId)
        .eq('status', 'pending')
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
};

export const createFriendRequest = async (senderId, receiverId) => {
    const { data, error } = await db
        .from('friend_requests')
        .insert({
            sender_id: senderId,
            receiver_id: receiverId,
            status: 'pending'
        })
        .select('*')
        .single();

    if (error) throw new Error(error.message);
    return data;
};

export const listPendingReceived = async (userId) => {
    const { data, error } = await db
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

export const updateFriendRequestStatus = async (requestId, receiverId, status) => {
    const { data, error } = await db
        .from('friend_requests')
        .update({
            status,
            responded_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('receiver_id', receiverId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
};

export const ensureFriendship = async (userAId, userBId) => {
    const [user_one_id, user_two_id] = pair(userAId, userBId);
    const { data, error } = await db
        .from('friendships')
        .upsert(
            {
                user_one_id,
                user_two_id
            },
            {
                onConflict: 'user_one_id,user_two_id',
                ignoreDuplicates: true
            }
        )
        .select('*')
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
};

export const listFriendships = async (userId) => {
    const { data, error } = await db
        .from('friendships')
        .select('*')
        .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

export const removeFriendship = async (userAId, userBId) => {
    const [user_one_id, user_two_id] = pair(userAId, userBId);
    const { error } = await db
        .from('friendships')
        .delete()
        .eq('user_one_id', user_one_id)
        .eq('user_two_id', user_two_id);
    if (error) throw new Error(error.message);
};

export const getUsersByIds = async (ids) => {
    if (!ids || ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const { data, error } = await db
        .from('users')
        .select('id, unique_id, username, profile_picture_url, status')
        .in('id', unique);
    if (error) throw new Error(error.message);
    return data || [];
};
