import { verifyToken, extractToken } from '../utils/jwt.js';
import { getUserById } from '../models/userModel.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */
export const authenticate = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                status: 'ERROR',
                message: 'Authentication token required',
                data: null
            });
        }

        const decoded = verifyToken(token);
        const user = await getUserById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                status: 'ERROR',
                message: 'User not found',
                data: null
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'Account is inactive',
                data: null
            });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            status: 'ERROR',
            message: error.message || 'Invalid authentication token',
            data: null
        });
    }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                status: 'ERROR',
                message: 'Authentication required',
                data: null
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                status: 'ERROR',
                message: 'Insufficient permissions',
                data: null
            });
        }

        next();
    };
};

