import db from '../config/db.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateCode = (length = 6) => {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return out;
};

export const getActiveConvoyForUser = async (userId) => {
    const { data, error } = await db
        .from('convoy_members')
        .select('convoys(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('convoys.status', 'active')
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
        .eq('status', 'active')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const createConvoy = async ({ created_by, name, max_members = 15 }) => {
    let created = null;
    let lastError = null;
    for (let i = 0; i < 8; i += 1) {
        const code = generateCode(6);
        const { data, error } = await db
            .from('convoys')
            .insert({
                code,
                name: name ? String(name).trim() : null,
                created_by,
                max_members
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
    return created;
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
    return data;
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
        .select('id, role, status, joined_at, users(id, unique_id, username, profile_picture_url, status)')
        .eq('convoy_id', convoyId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
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
        .eq('status', 'active')
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
