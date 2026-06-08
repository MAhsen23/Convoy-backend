import db from '../config/db.js';

export const upsertDriveRecap = async (row) => {
    const { data, error } = await db
        .from('drive_recaps')
        .upsert([row], { onConflict: 'convoy_id,user_id' })
        .select('*')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const getDriveRecapForUser = async (convoyId, userId) => {
    const { data, error } = await db
        .from('drive_recaps')
        .select('*')
        .eq('convoy_id', convoyId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const updateDriveRecapRoute = async (convoyId, userId, routeCoordinates) => {
    const { data, error } = await db
        .from('drive_recaps')
        .update({ route_coordinates: routeCoordinates })
        .eq('convoy_id', convoyId)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
};

export const listUserDriveRecaps = async (userId, limit = 20, offset = 0) => {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safeOffset = Math.max(offset, 0);

    const { data, error, count } = await db
        .from('drive_recaps')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw new Error(error.message);

    return {
        recaps: data || [],
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset
    };
};
