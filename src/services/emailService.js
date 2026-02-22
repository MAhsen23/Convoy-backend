/**
 * Email service - Sends transactional emails (OTP, etc.)
 * Production: use Resend (set RESEND_API_KEY). Dev: no send, OTP returned in API response.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.OTP_FROM_EMAIL || 'Convoy <noreply@convoy.app>';
const OTP_SUBJECT = 'Your Convoy verification code';

/**
 * Send OTP email via Resend (production only).
 * Returns { sent: true } on success, { sent: false, error } on failure.
 */
export const sendOTPEmail = async (toEmail, code) => {
    if (!RESEND_API_KEY) {
        return { sent: false, error: 'Email not configured (missing RESEND_API_KEY)' };
    }

    const body = {
        from: FROM_EMAIL,
        to: [toEmail],
        subject: OTP_SUBJECT,
        html: `
          <p>Your Convoy verification code is:</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
          <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        `.trim()
    };

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { sent: false, error: data.message || res.statusText };
        }
        return { sent: true };
    } catch (err) {
        return { sent: false, error: err.message };
    }
};
