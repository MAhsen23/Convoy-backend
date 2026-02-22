import { sendOTPByEmail, verifyOTPByEmail } from '../services/otpService.js';
import * as userModel from '../models/userModel.js';
import { generateToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';

/**
 * POST /api/auth/send-otp
 * Body: { email }
 */
export const sendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Email is required',
                data: null
            });
        }
        const result = await sendOTPByEmail(email);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: result.message,
            data: {
                expires_in_minutes: result.expires_in_minutes,
                ...(result.dev_code && { dev_code: result.dev_code })
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to send OTP',
            data: null
        });
    }
};

/**
 * POST /api/auth/register
 * Body: { email, code, username, password }
 * Verifies the OTP sent to email first; if valid, creates the account. Email must be verified to register.
 */
export const register = async (req, res) => {
    try {
        const { email, code, username, password } = req.body;
        if (!email || !code || !username || !password) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Email, verification code, username and password are required',
                data: null
            });
        }

        const verifyResult = await verifyOTPByEmail(email, code);
        if (!verifyResult.success) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: verifyResult.message,
                data: null
            });
        }

        const validation = userModel.validateUsername(username);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: validation.error,
                data: null
            });
        }

        const existing = await userModel.getByEmail(email.trim().toLowerCase());
        if (existing) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'An account with this email already exists',
                data: null
            });
        }

        const available = await userModel.isUsernameAvailable(username);
        if (!available) {
            return res.status(409).json({
                success: false,
                status: 'ERROR',
                message: 'Username is already taken',
                data: null
            });
        }

        const password_hash = await hashPassword(password);
        const user = await userModel.createUser({
            username: username.trim(),
            username_normalized: validation.normalized,
            email: email.trim().toLowerCase(),
            password_hash
        });

        const token = generateToken(user);
        const profile = userModel.toPublicProfile(user);
        return res.status(201).json({
            success: true,
            status: 'OK',
            message: 'Account created successfully',
            data: {
                token,
                user: profile
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Registration failed',
            data: null
        });
    }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Email and password are required',
                data: null
            });
        }

        const user = await userModel.getByEmail(email.trim().toLowerCase());
        if (!user) {
            return res.status(401).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid email or password',
                data: null
            });
        }

        if (!user.password_hash) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'This account uses sign-in with OTP. Use Send OTP then Verify OTP.',
                data: null
            });
        }

        const match = await comparePassword(password, user.password_hash);
        if (!match) {
            return res.status(401).json({
                success: false,
                status: 'ERROR',
                message: 'Invalid email or password',
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

        const token = generateToken(user);
        const profile = userModel.toPublicProfile(user);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Signed in successfully',
            data: {
                token,
                user: profile
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Login failed',
            data: null
        });
    }
};

/**
 * GET /api/auth/me
 * Requires: Authorization header
 */
export const getMe = async (req, res) => {
    try {
        const profile = userModel.toPublicProfile(req.user);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Profile retrieved',
            data: { user: profile }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to get profile',
            data: null
        });
    }
};

/**
 * GET /api/auth/check-username?username=xxx
 * Public; returns whether username is available.
 */
export const checkUsername = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({
                success: false,
                status: 'ERROR',
                message: 'Query parameter "username" is required',
                data: null
            });
        }
        const validation = userModel.validateUsername(username);
        if (!validation.valid) {
            return res.status(200).json({
                success: true,
                status: 'OK',
                data: { available: false, reason: validation.error }
            });
        }
        const available = await userModel.isUsernameAvailable(username);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { available }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Error occurred while checking username availability',
            data: null
        });
    }
};

/**
 * GET /api/auth/profile/:uniqueId
 * Public; returns public profile by 9-digit unique_id (for search/add friend).
 */
export const getProfileByUniqueId = async (req, res) => {
    try {
        const user = await userModel.getByUniqueId(req.params.uniqueId);
        if (!user) {
            return res.status(404).json({
                success: false,
                status: 'ERROR',
                message: 'User not found',
                data: null
            });
        }
        const profile = userModel.toPublicProfile(user);
        return res.status(200).json({
            success: true,
            status: 'OK',
            data: { user: profile }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to get profile',
            data: null
        });
    }
};

/**
 * PATCH /api/auth/profile
 * Body: { username?, profile_picture_url?, status?, udid?, device_info?, push_token? }
 */
export const updateProfile = async (req, res) => {
    try {
        const { username, profile_picture_url, status, udid, device_info, push_token } = req.body;
        const updates = {};
        if (profile_picture_url !== undefined) updates.profile_picture_url = profile_picture_url;
        if (udid !== undefined) updates.udid = udid;
        if (device_info !== undefined) updates.device_info = device_info;
        if (push_token !== undefined) updates.push_token = push_token;
        if (status !== undefined) {
            if (!['online', 'driving', 'offline'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    status: 'ERROR',
                    message: 'status must be one of: online, driving, offline',
                    data: null
                });
            }
            updates.status = status;
        }
        if (username !== undefined) {
            const validation = userModel.validateUsername(username);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    status: 'ERROR',
                    message: validation.error,
                    data: null
                });
            }
            const available = await userModel.isUsernameAvailable(username, req.user.id);
            if (!available) {
                return res.status(409).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Username is already taken',
                    data: null
                });
            }
            updates.username = username.trim();
            updates.username_normalized = validation.normalized;
        }

        if (Object.keys(updates).length === 0) {
            const profile = userModel.toPublicProfile(req.user);
            return res.status(200).json({
                success: true,
                status: 'OK',
                message: 'No changes',
                data: { user: profile }
            });
        }

        const user = await userModel.updateUser(req.user.id, updates);
        const profile = userModel.toPublicProfile(user);
        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Profile has been updated',
            data: { user: profile }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to update profile',
            data: null
        });
    }
};
