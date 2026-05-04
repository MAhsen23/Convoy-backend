import db from '../config/db.js';
import * as chatModel from './chatModel.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateCode = (length = 6) => {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return out;
};

const getOrCreateConvoyConversation = async (convoyId, createdByUserId) => {
    const { data: existing, error: existingError } = await db
        .from('conversations')
        .select('id')
        .eq('type', 'convoy')
        .eq('convoy_id', convoyId)
        .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return existing.id;

    const { data: created, error: createError } = await db
        .from('conversations')
        .insert({
            type: 'convoy',
            created_by: createdByUserId,
            convoy_id: convoyId
        })
        .select('id')
        .single();
    if (createError) throw new Error(createError.message);
    return created.id;
};

const ensureConversationMember = async (conversationId, userId) => {
    const { error } = await db
        .from('conversation_members')
        .upsert(
            [{ conversation_id: conversationId, user_id: userId }],
            { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
        );
    if (error) throw new Error(error.message);
};

export const getActiveConvoyForUser = async (userId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select('convoys(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .in('convoys.status', ['active', 'started'])
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.convoys || null;
};

export const getConvoyById = async (id) => {
    const { data, error } = await db
        .from('convoys')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const getConvoyByCode = async (code) => {
    const { data, error } = await db
        .from('convoys')
        .select('*')
        .eq('code', String(code || '').toUpperCase())
        .in('status', ['active', 'started'])
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const createConvoy = async ({
    created_by,
    name,
    icon_url = null,
    max_members = 15,
    destination = null
}) => {
    let created = null;
    let lastError = null;
    for (let i = 0; i < 8; i += 1) {
        const code = generateCode(6);
        const dest = destination || null;
        const { data, error } = await db
            .from('convoys')
            .insert({
                code,
                name: name ? String(name).trim() : null,
                icon_url: icon_url ? String(icon_url).trim() : null,
                created_by,
                max_members,
                destination_lat: dest?.lat ?? null,
                destination_lng: dest?.lng ?? null,
                destination_name: dest?.name ?? null,
                destination_address: dest?.address ?? null,
                destination_place_id: dest?.place_id ?? null,
                destination_updated_at: dest?.lat != null && dest?.lng != null ? new Date().toISOString() : null
            })
            .select('*')
            .single();

        if (!error) {
            created = data;
            break;
        }
        lastError = error;
    }
    if (!created) throw new Error(lastError?.message || 'Failed to create convoy');

    const { error: memberError } = await db
        .from('convoy_members')
        .insert({
            convoy_id: created.id,
            user_id: created_by,
            role: 'leader',
            status: 'active'
        });
    if (memberError) throw new Error(memberError.message);

    await db.from('users').update({ status: 'in_convoy' }).eq('id', created_by);
    const convoyConversationId = await getOrCreateConvoyConversation(created.id, created_by);
    await ensureConversationMember(convoyConversationId, created_by);
    return {
        ...created,
        conversation_id: convoyConversationId
    };
};

export const updateConvoyDestination = async (convoyId, destination) => {
    const dest = destination || null;
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('convoys')
        .update({
            destination_lat: dest?.lat ?? null,
            destination_lng: dest?.lng ?? null,
            destination_name: dest?.name ?? null,
            destination_address: dest?.address ?? null,
            destination_place_id: dest?.place_id ?? null,
            destination_updated_at: now
        })
        .eq('id', convoyId)
        .select('*')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const countActiveMembers = async (convoyId) => {
    const { count, error } = await db
        .from('convoy_members')
        .select('id', { count: 'exact', head: true })
        .eq('convoy_id', convoyId)
        .eq('status', 'active');
    if (error) throw new Error(error.message);
    return count || 0;
};

export const getMember = async (convoyId, userId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select('*')
        .eq('convoy_id', convoyId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const getMemberAnyStatus = async (convoyId, userId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select('*')
        .eq('convoy_id', convoyId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const addMember = async (convoyId, userId, role = 'member') => {
    const { data, error } = await db
        .from('convoy_members')
        .insert({
            convoy_id: convoyId,
            user_id: userId,
            role,
            status: 'active'
        })
        .select('*')
        .single();
    if (error) throw new Error(error.message);

    await db.from('users').update({ status: 'in_convoy' }).eq('id', userId);
    const convoyConversationId = await getOrCreateConvoyConversation(convoyId, userId);
    await ensureConversationMember(convoyConversationId, userId);
    return {
        ...data,
        conversation_id: convoyConversationId
    };
};

export const leaveConvoy = async (convoyId, userId) => {
    const { data, error } = await db
        .from('convoy_members')
        .update({
            status: 'left',
            left_at: new Date().toISOString()
        })
        .eq('convoy_id', convoyId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select('*')
        .maybeSingle();
    if (error) throw new Error(error.message);

    await db.from('users').update({ status: 'online' }).eq('id', userId);
    return data;
};

export const listMembers = async (convoyId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select(
            'user_id, id, role, status, joined_at, distance_km, users(id, unique_id, username, display_name, profile_picture_url, status)'
        )
        .eq('convoy_id', convoyId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

export const listMembersAnyStatus = async (convoyId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select(
            'user_id, id, role, status, joined_at, left_at, distance_km, users(id, unique_id, username, display_name, profile_picture_url, status)'
        )
        .eq('convoy_id', convoyId)
        .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

export const listUserEndedConvoyHistory = async (userId, limit = 20, offset = 0) => {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safeOffset = Math.max(offset, 0);

    const { data, error } = await db
        .from('convoy_members')
        .select(
            'convoy_id, role, status, joined_at, left_at, distance_km, convoys!inner(id, code, name, icon_url, created_by, status, max_members, started_at, ended_at, created_at, destination_lat, destination_lng, destination_name, destination_address, destination_place_id, destination_updated_at)'
        )
        .eq('user_id', userId)
        .eq('convoys.status', 'ended')
        .order('left_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw new Error(error.message);

    const { count, error: countErr } = await db
        .from('convoy_members')
        .select('id, convoys!inner(id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('convoys.status', 'ended');
    if (countErr) throw new Error(countErr.message);

    const rows = data || [];
    const convoys = rows.map((r) => ({
        convoy: r.convoys,
        membership: {
            role: r.role,
            status: r.status,
            joined_at: r.joined_at,
            left_at: r.left_at,
            distance_km: r.distance_km ?? 0
        }
    }));

    // Compute member_count for returned convoys (cheap single extra query)
    const convoyIds = [...new Set(rows.map((r) => r.convoy_id).filter((id) => Number.isInteger(id)))];
    let memberCountByConvoyId = {};
    if (convoyIds.length > 0) {
        const { data: memberRows, error: mcErr } = await db
            .from('convoy_members')
            .select('convoy_id')
            .in('convoy_id', convoyIds);
        if (mcErr) throw new Error(mcErr.message);
        memberCountByConvoyId = (memberRows || []).reduce((acc, m) => {
            acc[m.convoy_id] = (acc[m.convoy_id] || 0) + 1;
            return acc;
        }, {});
    }

    return {
        convoys: convoys.map((x) => ({
            ...x.convoy,
            member_count: memberCountByConvoyId[x.convoy.id] || 0,
            my_role: x.membership.role,
            my_membership_status: x.membership.status,
            my_joined_at: x.membership.joined_at,
            my_left_at: x.membership.left_at,
            my_distance_km: x.membership.distance_km
        })),
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset
    };
};

export const listActiveMemberUserIds = async (convoyId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select('user_id')
        .eq('convoy_id', convoyId)
        .eq('status', 'active');
    if (error) throw new Error(error.message);
    return (data || []).map((r) => r.user_id);
};

/**
 * @param {Array<{ user_id: number, distance_km?: number }>} rows
 */
export const setConvoyMembersDistanceKm = async (convoyId, rows) => {
    if (!rows?.length) return;
    for (const row of rows) {
        const userId = row.user_id;
        if (!Number.isInteger(userId)) continue;
        const km = Math.round(Math.max(0, Number(row.distance_km) || 0) * 1000) / 1000;
        const { error } = await db
            .from('convoy_members')
            .update({ distance_km: km })
            .eq('convoy_id', convoyId)
            .eq('user_id', userId);
        if (error) throw new Error(error.message);
    }
};

export const setMemberDistanceKm = async (convoyId, userId, distanceKm) => {
    const km = Math.round(Math.max(0, Number(distanceKm) || 0) * 1000) / 1000;
    const { error } = await db
        .from('convoy_members')
        .update({ distance_km: km })
        .eq('convoy_id', convoyId)
        .eq('user_id', userId);
    if (error) throw new Error(error.message);
};

export const endConvoy = async (convoyId) => {
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('convoys')
        .update({
            status: 'ended',
            ended_at: now
        })
        .eq('id', convoyId)
        .in('status', ['active', 'started'])
        .select('*')
        .maybeSingle();
    if (error) throw new Error(error.message);

    await db
        .from('convoy_members')
        .update({
            status: 'left',
            left_at: now
        })
        .eq('convoy_id', convoyId)
        .eq('status', 'active');

    const { data: memberRows } = await db
        .from('convoy_members')
        .select('user_id')
        .eq('convoy_id', convoyId);
    const ids = (memberRows || []).map(r => r.user_id);
    if (ids.length > 0) {
        await db.from('users').update({ status: 'online' }).in('id', ids);
    }

    return data;
};

export const startConvoy = async (convoyId) => {
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('convoys')
        .update({
            status: 'started',
            started_at: now,
            ended_at: null
        })
        .eq('id', convoyId)
        .eq('status', 'active')
        .select('*')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const createInvite = async (convoyId, inviterId, inviteeId) => {
    const { data, error } = await db
        .from('convoy_invites')
        .insert({
            convoy_id: convoyId,
            inviter_id: inviterId,
            invitee_id: inviteeId,
            status: 'pending'
        })
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const listPendingInvites = async (userId) => {
    const { data, error } = await db
        .from('convoy_invites')
        .select('*, convoys(id, code, name, status), inviter:users!convoy_invites_inviter_id_fkey(id, username, profile_picture_url)')
        .eq('invitee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

export const getInviteByIdForUser = async (inviteId, inviteeId) => {
    const { data, error } = await db
        .from('convoy_invites')
        .select('*')
        .eq('id', inviteId)
        .eq('invitee_id', inviteeId)
        .eq('status', 'pending')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const respondInvite = async (inviteId, inviteeId, status) => {
    const { data, error } = await db
        .from('convoy_invites')
        .update({
            status,
            responded_at: new Date().toISOString()
        })
        .eq('id', inviteId)
        .eq('invitee_id', inviteeId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const getConvoyConversationByConvoyId = async (convoyId) => {
    const { data, error } = await db
        .from('conversations')
        .select('id, type, convoy_id, created_at')
        .eq('type', 'convoy')
        .eq('convoy_id', convoyId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const getConvoyConversationById = async (conversationId) => {
    const { data, error } = await db
        .from('conversations')
        .select('id, type, convoy_id, created_at')
        .eq('id', conversationId)
        .eq('type', 'convoy')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const createConvoyMessageByConversationId = async (
    conversationId,
    senderId,
    content,
    type = 'text',
    metadata = null
) => {
    return chatModel.createMessageWithSender(
        conversationId,
        senderId,
        content,
        type,
        metadata
    );
};

export const listConvoyMessages = async (convoyId, limit = 50, offset = 0) => {
    const convoyConversation = await getConvoyConversationByConvoyId(convoyId);
    if (!convoyConversation) {
        return { messages: [], total: 0, limit, offset };
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const { data, error, count } = await db
        .from('messages')
        .select('id, conversation_id, sender_id, type, content, metadata, created_at, sender:users!messages_sender_id_fkey(id, username, profile_picture_url, status)', { count: 'exact' })
        .eq('conversation_id', convoyConversation.id)
        .order('created_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw new Error(error.message);

    const messages = (data || []).map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        type: m.type,
        content: m.content,
        metadata: m.metadata,
        created_at: m.created_at,
        sender: m.sender || null
    }));

    return {
        messages,
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset
    };
};
