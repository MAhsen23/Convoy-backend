import db from '../config/db.js';

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

export const getOrCreateDirectConversation = async (currentUserId, otherUserId) => {
    const [direct_user_one_id, direct_user_two_id] = pair(currentUserId, otherUserId);

    const { data: existing, error: existingError } = await db
        .from('conversations')
        .select('*')
        .eq('type', 'direct')
        .eq('direct_user_one_id', direct_user_one_id)
        .eq('direct_user_two_id', direct_user_two_id)
        .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
        await db
            .from('conversation_members')
            .upsert(
                [
                    { conversation_id: existing.id, user_id: direct_user_one_id },
                    { conversation_id: existing.id, user_id: direct_user_two_id }
                ],
                { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
            );
        return existing;
    }

    const { data: created, error: createError } = await db
        .from('conversations')
        .insert({
            type: 'direct',
            created_by: currentUserId,
            direct_user_one_id,
            direct_user_two_id
        })
        .select('*')
        .single();
    if (createError) throw new Error(createError.message);

    const { error: memberError } = await db.from('conversation_members').insert([
        { conversation_id: created.id, user_id: direct_user_one_id },
        { conversation_id: created.id, user_id: direct_user_two_id }
    ]);
    if (memberError) throw new Error(memberError.message);

    return created;
};

export const isConversationMember = async (conversationId, userId) => {
    const { data, error } = await db
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
};

export const listUserConversations = async (userId) => {
    const { data: memberships, error: memError } = await db
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);
    if (memError) throw new Error(memError.message);

    const ids = (memberships || []).map(m => m.conversation_id);
    if (ids.length === 0) return [];

    const { data: conversations, error: convError } = await db
        .from('conversations')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });
    if (convError) throw new Error(convError.message);

    const { data: latestMessages, error: msgError } = await db
        .from('messages')
        .select('id, conversation_id, sender_id, type, content, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false });
    if (msgError) throw new Error(msgError.message);

    const firstMsgByConversation = {};
    for (const m of latestMessages || []) {
        if (!firstMsgByConversation[m.conversation_id]) firstMsgByConversation[m.conversation_id] = m;
    }

    const readMap = new Map((memberships || []).map(m => [m.conversation_id, m.last_read_at]));

    const directOtherUserIds = (conversations || [])
        .filter(c => c.type === 'direct')
        .map(c => (c.direct_user_one_id === userId ? c.direct_user_two_id : c.direct_user_one_id));

    const { data: otherUsers, error: usersError } = await db
        .from('users')
        .select('id, username, profile_picture_url, status')
        .in('id', [...new Set(directOtherUserIds)]);
    if (usersError) throw new Error(usersError.message);

    const otherUserMap = new Map((otherUsers || []).map(u => [u.id, u]));

    const withUnread = await Promise.all(
        (conversations || []).map(async c => {
            const lastReadAt = readMap.get(c.id) || null;

            let query = db
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', c.id)
                .neq('sender_id', userId);

            if (lastReadAt) {
                query = query.gt('created_at', lastReadAt);
            }

            const { count, error } = await query;
            if (error) throw new Error(error.message);

            const latest = firstMsgByConversation[c.id] || null;
            const otherId = c.type === 'direct'
                ? (c.direct_user_one_id === userId ? c.direct_user_two_id : c.direct_user_one_id)
                : null;
            const other = otherId ? otherUserMap.get(otherId) : null;

            return {
                id: c.id,
                type: c.type,
                direct_user_one_id: c.direct_user_one_id,
                direct_user_two_id: c.direct_user_two_id,
                created_at: c.created_at,
                latest_message: latest ? latest.content : null,
                latest_message_at: latest ? latest.created_at : null,
                unread_count: count || 0,
                other_user: other
                    ? {
                        id: other.id,
                        username: other.username,
                        profile_picture_url: other.profile_picture_url,
                        status: ['online', 'driving', 'in_convoy', 'offline'].includes(other.status)
                            ? other.status
                            : 'offline'
                    }
                    : null
            };
        })
    );

    return withUnread.sort((a, b) => {
        const at = a.latest_message_at || a.created_at;
        const bt = b.latest_message_at || b.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
    });
};

export const listConversationMessages = async (conversationId, limit = 50, offset = 0) => {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const { data, error } = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) throw new Error(error.message);
    return data || [];
};

export const createMessage = async (conversationId, senderId, content, type = 'text', metadata = null) => {
    const { data, error } = await db
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: senderId,
            type,
            content,
            metadata
        })
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const markConversationRead = async (conversationId, userId) => {
    const { data, error } = await db
        .from('conversation_members')
        .update({
            last_read_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .select('conversation_id, user_id, last_read_at')
        .single();
    if (error) throw new Error(error.message);
    return data;
};
