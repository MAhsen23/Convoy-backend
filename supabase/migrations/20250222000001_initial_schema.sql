-- Convoy Backend: Initial schema for users and OTP
-- Run this in Supabase SQL Editor or via: supabase db push

-- Sequence for 9-digit user display IDs (100_000_000 to 999_999_999)
-- Easy to share and search; ~900M capacity
CREATE SEQUENCE IF NOT EXISTS user_unique_id_seq
  START WITH 100000000
  INCREMENT BY 1
  MINVALUE 100000000
  MAXVALUE 999999999
  NO CYCLE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_id INTEGER NOT NULL UNIQUE DEFAULT nextval('user_unique_id_seq'),
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  profile_picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'driving', 'offline')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Index for search by unique_id (e.g. "find user by 9-digit ID")
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_id ON users (unique_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized ON users (username_normalized);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- OTP codes: support both email (production) and phone (legacy/dev)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT otp_email_or_phone CHECK (
    (email IS NOT NULL AND phone IS NULL) OR (email IS NULL AND phone IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes (expires_at);

-- API request logs (for requestLogger / analytics)
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  method TEXT,
  url TEXT,
  path TEXT,
  status_code INTEGER,
  user_id UUID REFERENCES users(id),
  ip_address TEXT,
  user_agent TEXT,
  request_body JSONB,
  response_body JSONB,
  duration_ms INTEGER,
  success BOOLEAN,
  status TEXT,
  message TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_request_id ON api_logs (request_id);

COMMENT ON COLUMN users.unique_id IS '9-digit public ID for sharing and search (e.g. #100000001)';
COMMENT ON COLUMN users.username_normalized IS 'Lowercase username for case-insensitive uniqueness';
