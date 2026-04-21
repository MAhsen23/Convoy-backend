ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN users.display_name IS 'Optional human-friendly name for UI display (fallback to username).';

