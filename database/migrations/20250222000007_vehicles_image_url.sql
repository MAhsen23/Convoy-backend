-- Add vehicle image URL (e.g. from upload/Cloudinary).
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_url TEXT;
