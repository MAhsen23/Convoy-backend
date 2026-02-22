import db from '../config/db.js';

/**
 * API Log Model - Handles storing API request/response logs in database
 */

/**
 * Create API log entry
 */
export const createApiLog = async (logData) => {
    const {
        request_id,
        method,
        url,
        path,
        status_code,
        user_id,
        ip_address,
        user_agent,
        request_body,
        response_body,
        duration_ms,
        success,
        status,
        message,
        error_message
    } = logData;

    try {
        const { data, error } = await db
            .from('api_logs')
            .insert({
                request_id,
                method,
                url,
                path,
                status_code,
                user_id: user_id || null,
                ip_address,
                user_agent,
                request_body: request_body || null,
                response_body: response_body || null,
                duration_ms,
                success,
                status,
                message,
                error_message: error_message || null
            })
            .select()
            .single();

        if (error) {
            return null;
        }

        return data;
    } catch (error) {
        return null;
    }
};

/**
 * Get API logs with filters
 */
export const getApiLogs = async (filters = {}) => {
    const {
        user_id,
        method,
        path,
        status_code,
        success,
        start_date,
        end_date,
        limit = 100,
        offset = 0
    } = filters;

    let query = db.from('api_logs').select('*', { count: 'exact' });

    if (user_id) {
        query = query.eq('user_id', user_id);
    }

    if (method) {
        query = query.eq('method', method);
    }

    if (path) {
        query = query.ilike('path', `%${path}%`);
    }

    if (status_code) {
        query = query.eq('status_code', status_code);
    }

    if (success !== undefined) {
        query = query.eq('success', success);
    }

    if (start_date) {
        query = query.gte('created_at', start_date);
    }

    if (end_date) {
        query = query.lte('created_at', end_date);
    }

    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return {
        logs: data || [],
        total: count || 0
    };
};

/**
 * Get API log by request ID
 */
export const getApiLogByRequestId = async (requestId) => {
    const { data, error } = await db
        .from('api_logs')
        .select('*')
        .eq('request_id', requestId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
    }

    return data;
};

/**
 * Get API statistics
 */
export const getApiStatistics = async (filters = {}) => {
    const { start_date, end_date } = filters;

    let query = db.from('api_logs').select('*');

    if (start_date) {
        query = query.gte('created_at', start_date);
    }

    if (end_date) {
        query = query.lte('created_at', end_date);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    const total = data.length;
    const successful = data.filter(log => log.success).length;
    const failed = total - successful;
    const avgDuration = data.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / total || 0;

    const endpointStats = {};
    data.forEach(log => {
        const key = `${log.method} ${log.path}`;
        if (!endpointStats[key]) {
            endpointStats[key] = { count: 0, success: 0, totalDuration: 0 };
        }
        endpointStats[key].count++;
        if (log.success) endpointStats[key].success++;
        endpointStats[key].totalDuration += log.duration_ms || 0;
    });

    const statusCodeStats = {};
    data.forEach(log => {
        const code = log.status_code || 'unknown';
        statusCodeStats[code] = (statusCodeStats[code] || 0) + 1;
    });

    return {
        total,
        successful,
        failed,
        success_rate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
        avg_duration_ms: Math.round(avgDuration),
        endpoint_stats: endpointStats,
        status_code_stats: statusCodeStats
    };
};

