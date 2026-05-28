import db from '../config/db.js';

export const HAZARD_TYPES = [
    'speed_camera',
    'police',
    'accident',
    'road_hazard',
    'construction',
    'traffic'
];

export const listHazardTypes = async () => {
    const { data, error } = await db
        .from('hazard_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

export const getHazardType = async (type) => {
    const { data, error } = await db
        .from('hazard_types')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const createReport = async (payload) => {
    const { data, error } = await db.from('hazard_reports').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return data;
};

export const getReportById = async (id) => {
    const { data, error } = await db.from('hazard_reports').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const updateReport = async (id, updates) => {
    const { data, error } = await db
        .from('hazard_reports')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const listNearbyActive = async ({ min_lat, max_lat, min_lng, max_lng, types, limit }) => {
    let q = db
        .from('hazard_reports')
        .select(
            '*, reporter:users!hazard_reports_reporter_id_fkey(id, username, display_name, profile_picture_url)'
        )
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .gte('lat', min_lat)
        .lte('lat', max_lat)
        .gte('lng', min_lng)
        .lte('lng', max_lng)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (types?.length) q = q.in('type', types);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
};

export const countRecentReportsByUser = async (userId, sinceIso) => {
    const { count, error } = await db
        .from('hazard_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_id', userId)
        .gte('created_at', sinceIso);
    if (error) throw new Error(error.message);
    return count || 0;
};

export const listRecentReportsByUser = async (userId, sinceIso) => {
    const { data, error } = await db
        .from('hazard_reports')
        .select('id, lat, lng, created_at')
        .eq('reporter_id', userId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) throw new Error(error.message);
    return data || [];
};

export const upsertVote = async (hazardId, userId, vote) => {
    const { data, error } = await db
        .from('hazard_votes')
        .upsert(
            { hazard_id: hazardId, user_id: userId, vote, updated_at: new Date().toISOString() },
            { onConflict: 'hazard_id,user_id' }
        )
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const getVote = async (hazardId, userId) => {
    const { data, error } = await db
        .from('hazard_votes')
        .select('*')
        .eq('hazard_id', hazardId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const countVotes = async (hazardId) => {
    const { data, error } = await db.from('hazard_votes').select('vote').eq('hazard_id', hazardId);
    if (error) throw new Error(error.message);
    let confirm_count = 0;
    let reject_count = 0;
    for (const row of data || []) {
        if (row.vote === 'confirm') confirm_count += 1;
        if (row.vote === 'reject') reject_count += 1;
    }
    return { confirm_count, reject_count };
};

export const expireDueReports = async () => {
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('hazard_reports')
        .update({ status: 'expired' })
        .eq('status', 'active')
        .lt('expires_at', now)
        .select('id, lat, lng');
    if (error) throw new Error(error.message);
    return data || [];
};

export const listMyReports = async (userId, limit, offset) => {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safeOffset = Math.max(offset, 0);
    const { data, error, count } = await db
        .from('hazard_reports')
        .select('*', { count: 'exact' })
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw new Error(error.message);
    return { reports: data || [], total: count || 0, limit: safeLimit, offset: safeOffset };
};
