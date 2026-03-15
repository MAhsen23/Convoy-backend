import db from '../config/db.js';

export const createSocketEventLog = async (logData) => {
    const {
        event_id,
        direction,
        event_name,
        socket_id,
        user_id,
        room,
        target_user_ids,
        conversation_id,
        convoy_id,
        payload,
        status,
        error_message
    } = logData;

    try {
        const { data, error } = await db
            .from('socket_event_logs')
            .insert({
                event_id,
                direction,
                event_name,
                socket_id: socket_id || null,
                user_id: user_id || null,
                room: room || null,
                target_user_ids: target_user_ids || null,
                conversation_id: conversation_id || null,
                convoy_id: convoy_id || null,
                payload: payload || null,
                status: status || 'OK',
                error_message: error_message || null
            })
            .select()
            .single();

        if (error) return null;
        return data;
    } catch {
        return null;
    }
};

export const getSocketEventLogs = async (filters = {}) => {
    const {
        event_name,
        direction,
        user_id,
        conversation_id,
        convoy_id,
        status,
        start_date,
        end_date,
        limit = 100,
        offset = 0
    } = filters;

    let query = db.from('socket_event_logs').select('*', { count: 'exact' });

    if (event_name) query = query.ilike('event_name', `%${event_name}%`);
    if (direction) query = query.eq('direction', direction);
    if (user_id) query = query.eq('user_id', user_id);
    if (conversation_id) query = query.eq('conversation_id', conversation_id);
    if (convoy_id) query = query.eq('convoy_id', convoy_id);
    if (status) query = query.eq('status', status);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
        logs: data || [],
        total: count || 0
    };
};

export const getSocketEventStatistics = async (filters = {}) => {
    const { start_date, end_date } = filters;

    let query = db.from('socket_event_logs').select('*');
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = data || [];
    const total = rows.length;
    const successful = rows.filter((row) => row.status !== 'ERROR').length;
    const failed = total - successful;

    const byEvent = {};
    const byDirection = {};

    rows.forEach((row) => {
        byEvent[row.event_name] = (byEvent[row.event_name] || 0) + 1;
        byDirection[row.direction] = (byDirection[row.direction] || 0) + 1;
    });

    return {
        total,
        successful,
        failed,
        success_rate: total > 0 ? Number(((successful / total) * 100).toFixed(2)) : 0,
        event_stats: byEvent,
        direction_stats: byDirection
    };
};
