import jwt from 'jsonwebtoken';
import config from '../config/config.js';

const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRY = config.jwtExpiry;

/**
 * Generate JWT token for user
 */
export const generateToken = (user) => {
    const payload = {
        id: user.id
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY
    });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

/**
 * Extract token from Authorization header
 */
export const extractToken = (req) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return null;
    }

    const parts = authHeader.split(' ');
    return parts.length === 2 ? parts[1] : parts[0];
};

