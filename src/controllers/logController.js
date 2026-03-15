import { getApiLogByRequestId, getApiLogs, getApiStatistics } from '../models/apiLogModel.js';
import { getSocketEventLogs, getSocketEventStatistics } from '../models/socketEventLogModel.js';

const toInt = (value, fallback = undefined) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
};

export const getLogs = async (req, res) => {
    try {
        const {
            user_id,
            method,
            path,
            status_code,
            success,
            start_date,
            end_date,
            limit = '100',
            offset = '0'
        } = req.query;

        const filters = {
            user_id: toInt(user_id),
            method: method ? String(method).toUpperCase() : undefined,
            path: path ? String(path) : undefined,
            status_code: toInt(status_code),
            success: success === undefined ? undefined : String(success) === 'true',
            start_date: start_date ? String(start_date) : undefined,
            end_date: end_date ? String(end_date) : undefined,
            limit: toInt(limit, 100),
            offset: toInt(offset, 0)
        };

        const result = await getApiLogs(filters);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'API logs retrieved successfully',
            data: {
                logs: result.logs,
                pagination: {
                    total: result.total,
                    limit: filters.limit,
                    offset: filters.offset,
                    count: result.logs.length,
                    hasMore: filters.offset + filters.limit < result.total
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to retrieve API logs',
            data: null
        });
    }
};

export const getLogByRequestId = async (req, res) => {
    try {
        const log = await getApiLogByRequestId(String(req.params.requestId || ''));
        if (!log) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'API log not found',
                data: null
            });
        }

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'API log retrieved successfully',
            data: { log }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to retrieve API log',
            data: null
        });
    }
};

export const getStatistics = async (req, res) => {
    try {
        const filters = {
            start_date: req.query.start_date ? String(req.query.start_date) : undefined,
            end_date: req.query.end_date ? String(req.query.end_date) : undefined
        };
        const statistics = await getApiStatistics(filters);

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'API statistics retrieved successfully',
            data: { statistics }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to retrieve API statistics',
            data: null
        });
    }
};

export const listSocketLogs = async (req, res) => {
    try {
        const {
            event_name,
            direction,
            user_id,
            conversation_id,
            convoy_id,
            status,
            start_date,
            end_date,
            limit = '100',
            offset = '0'
        } = req.query;

        const filters = {
            event_name: event_name ? String(event_name) : undefined,
            direction: direction ? String(direction) : undefined,
            user_id: toInt(user_id),
            conversation_id: toInt(conversation_id),
            convoy_id: toInt(convoy_id),
            status: status ? String(status) : undefined,
            start_date: start_date ? String(start_date) : undefined,
            end_date: end_date ? String(end_date) : undefined,
            limit: toInt(limit, 100),
            offset: toInt(offset, 0)
        };

        const result = await getSocketEventLogs(filters);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: {
                logs: result.logs,
                pagination: {
                    total: result.total,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + filters.limit < result.total
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to fetch socket event logs',
            data: null
        });
    }
};

export const socketLogStats = async (req, res) => {
    try {
        const filters = {
            start_date: req.query.start_date ? String(req.query.start_date) : undefined,
            end_date: req.query.end_date ? String(req.query.end_date) : undefined
        };
        const statistics = await getSocketEventStatistics(filters);

        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { statistics }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to fetch socket event statistics',
            data: null
        });
    }
};
