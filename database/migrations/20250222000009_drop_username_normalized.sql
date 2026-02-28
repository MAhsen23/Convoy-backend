-- Remove the unique constraint on username_normalized
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_normalized_key;

-- Drop the index heavily associated with it
DROP INDEX IF EXISTS idx_users_username_normalized;

-- Assuming `username` currently has both cases, let's make sure it's strictly lowercase before we enforce a unique constraint,
-- This prevents crashes when applying the unique index inside Postgres if duplicate case-insensitive rows exist.
UPDATE users SET username = LOWER(TRIM(username));

-- Enforce the unique constraint on the original username column now
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

-- Create a unique index for optimized searching on the primary username
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Drop the old column
ALTER TABLE users DROP COLUMN IF EXISTS username_normalized;
