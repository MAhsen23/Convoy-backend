import db from '../config/db.js';
import config from '../config/config.js';
import { sendOTPEmail } from './emailService.js';

/**
 * OTP Service - Handles OTP generation, storage, and verification.
 * - Email OTP: used in production (sends via Resend); in dev uses fixed code and no email.
 * - Phone OTP: kept for legacy; in dev uses fixed code, in prod would use SMS (not implemented).
 */

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const DEV_OTP_CODE = '123456';

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Dev mode: bypass real delivery and accept DEV_OTP_CODE.
 */
export const isDevMode = () => {
    return process.env.BYPASS_OTP === 'true' || config.env === 'development';
};

// ---------- Email OTP (primary for production) ----------

/**
 * Send OTP to email.
 * Production: generates code, stores in DB, sends email via Resend.
 * Dev: uses DEV_OTP_CODE, stores in DB, does not send email; code is returned in response.
 */
export const sendOTPByEmail = async (email) => {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) throw new Error('Email is required');

    const code = isDevMode() ? DEV_OTP_CODE : generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await db
        .from('otp_codes')
        .update({ is_used: true })
        .eq('email', normalizedEmail)
        .eq('is_used', false);

    const { data, error } = await db
        .from('otp_codes')
        .insert({
            email: normalizedEmail,
            phone: null,
            code,
            expires_at: expiresAt.toISOString(),
            is_used: false,
            attempts: 0
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create OTP: ${error.message}`);

    if (!isDevMode()) {
        const { sent, error: sendErr } = await sendOTPEmail(normalizedEmail, code);
        if (!sent) throw new Error(sendErr || 'Failed to send OTP email');
    }

    return {
        success: true,
        message: isDevMode()
            ? `OTP sent (DEV MODE - Code: ${code})`
            : 'Verification code sent to your email',
        expires_in_minutes: OTP_EXPIRY_MINUTES,
        ...(isDevMode() && { dev_code: code })
    };
};

/**
 * Verify OTP for email.
 */
export const verifyOTPByEmail = async (email, code) => {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
        return { success: false, message: 'Email is required' };
    }

    if (isDevMode() && code === DEV_OTP_CODE) {
        await db
            .from('otp_codes')
            .update({ is_used: true })
            .eq('email', normalizedEmail)
            .eq('is_used', false);
        return { success: true, message: 'OTP verified successfully (DEV MODE)' };
    }

    const { data: otpData, error: fetchError } = await db
        .from('otp_codes')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !otpData) {
        return { success: false, message: 'Invalid or expired OTP code' };
    }

    if (otpData.attempts >= MAX_ATTEMPTS) {
        return {
            success: false,
            message: 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
    }

    if (otpData.code !== code) {
        await db
            .from('otp_codes')
            .update({ attempts: otpData.attempts + 1 })
            .eq('id', otpData.id);
        const remaining = MAX_ATTEMPTS - (otpData.attempts + 1);
        return {
            success: false,
            message: `Invalid OTP code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new OTP.'}`
        };
    }

    await db.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);
    return { success: true, message: 'OTP verified successfully' };
};

// ---------- Phone OTP (legacy / optional) ----------

/**
 * Send OTP to phone number.
 * In production, integrate with SMS (Twilio, etc.). In dev, uses fixed code.
 */
export const sendOTP = async (phone) => {
    const code = isDevMode() ? DEV_OTP_CODE : generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await db
        .from('otp_codes')
        .update({ is_used: true })
        .eq('phone', phone)
        .eq('is_used', false);

    const { data, error } = await db
        .from('otp_codes')
        .insert({
            email: null,
            phone,
            code,
            expires_at: expiresAt.toISOString(),
            is_used: false,
            attempts: 0
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create OTP: ${error.message}`);

    // TODO: In production, integrate with SMS service
    return {
        success: true,
        message: isDevMode()
            ? `OTP sent (DEV MODE - Code: ${code})`
            : 'OTP sent to your phone number',
        expires_in_minutes: OTP_EXPIRY_MINUTES,
        ...(isDevMode() && { dev_code: code })
    };
};

/**
 * Verify OTP code for phone.
 */
export const verifyOTP = async (phone, code) => {
    if (isDevMode() && code === DEV_OTP_CODE) {
        await db
            .from('otp_codes')
            .update({ is_used: true })
            .eq('phone', phone)
            .eq('is_used', false);
        return { success: true, message: 'OTP verified successfully (DEV MODE)' };
    }

    const { data: otpData, error: fetchError } = await db
        .from('otp_codes')
        .select('*')
        .eq('phone', phone)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !otpData) {
        return { success: false, message: 'Invalid or expired OTP code' };
    }

    if (otpData.attempts >= MAX_ATTEMPTS) {
        return {
            success: false,
            message: 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
    }

    if (otpData.code !== code) {
        await db
            .from('otp_codes')
            .update({ attempts: otpData.attempts + 1 })
            .eq('id', otpData.id);
        const remaining = MAX_ATTEMPTS - (otpData.attempts + 1);
        return {
            success: false,
            message: `Invalid OTP code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new OTP.'}`
        };
    }

    await db.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);
    return { success: true, message: 'OTP verified successfully' };
};

/**
 * Clean up expired OTPs (call periodically).
 */
export const cleanupExpiredOTPs = async () => {
    const { error } = await db
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString());
    if (error) {
        console.error('OTP cleanup error:', error.message);
    }
};
