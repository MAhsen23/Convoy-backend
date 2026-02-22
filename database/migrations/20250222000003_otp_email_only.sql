-- If you already have otp_codes with a phone column (from an older schema), run this to make OTP email-only.
-- If you have rows with NULL email (old phone OTPs), delete them first: DELETE FROM otp_codes WHERE email IS NULL;
ALTER TABLE otp_codes DROP COLUMN IF EXISTS phone;
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS otp_email_or_phone;
ALTER TABLE otp_codes ALTER COLUMN email SET NOT NULL;
