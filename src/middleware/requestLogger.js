import { print } from '../helpers/helpers.js';
import config from '../config/config.js';

/**
 * Request/Response Logger Middleware
 * Logs all incoming requests and outgoing responses with detailed information
 * Optionally stores logs in database for monitoring and auditing
 */
export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const requestLog = {
        requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        query: req.query,
        params: req.params,
        headers: {
            'content-type': req.headers['content-type'],
            'authorization': req.headers['authorization'] ? 'Bearer ***' : undefined,
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip']
        },
        body: sanitizeRequestBody(req.body),
        ip: req.ip || req.connection.remoteAddress
    };

    print('=== REQUEST ===');
    print(JSON.stringify(requestLog, null, 2));

    req.requestId = requestId;
    req.startTime = startTime;

    const originalJson = res.json.bind(res);
    res.json = async function (data) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const responseLog = {
            requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            response: sanitizeResponseBody(data),
            success: data?.success || false,
            status: data?.status || 'UNKNOWN',
            message: data?.message || ''
        };

        if (config.logToDatabase && shouldLogToDatabase(req.path, req.method)) {
            try {
                const { createApiLog } = await import('../models/apiLogModel.js');
                await createApiLog({
                    request_id: requestId,
                    method: req.method,
                    url: req.originalUrl || req.url,
                    path: req.path,
                    status_code: res.statusCode,
                    user_id: req.user?.id || null,
                    ip_address: req.ip || req.connection.remoteAddress,
                    user_agent: req.headers['user-agent'],
                    request_body: sanitizeRequestBody(req.body),
                    response_body: sanitizeResponseBody(data),
                    duration_ms: duration,
                    success: data?.success || false,
                    status: data?.status || 'UNKNOWN',
                    message: data?.message || '',
                    error_message: data?.success === false ? data?.message : null
                });
            } catch (error) {
            }
        }

        return originalJson(data);
    };

    next();
};

/**
 * Sanitize request body - remove sensitive information
 */
const sanitizeRequestBody = (body) => {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'password_hash', 'otp', 'token', 'secret', 'api_key'];

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';
        }
    });

    return sanitized;
};

/**
 * Sanitize response body - remove sensitive information
 */
const sanitizeResponseBody = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const sanitized = JSON.parse(JSON.stringify(data));
    const removeSensitiveFields = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => removeSensitiveFields(item));
        }

        const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'api_key'];
        const result = { ...obj };

        sensitiveFields.forEach(field => {
            if (result[field]) {
                result[field] = '***REDACTED***';
            }
        });

        Object.keys(result).forEach(key => {
            if (typeof result[key] === 'object' && result[key] !== null) {
                result[key] = removeSensitiveFields(result[key]);
            }
        });

        return result;
    };

    return removeSensitiveFields(sanitized);
};

/**
 * Determine if request should be logged to database
 * Based on configuration and endpoint importance
 */
const shouldLogToDatabase = (path, method) => {
    if (config.logAllRequests) {
        return true;
    }

    const importantPaths = [
        '/api/auth/register',
        '/api/auth/profile'
    ];

    return importantPaths.some(importantPath => path.includes(importantPath)) ||
        ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
};

