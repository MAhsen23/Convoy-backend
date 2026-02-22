CREATE SEQUENCE IF NOT EXISTS user_unique_id_seq
  START WITH 1247190
  INCREMENT BY 1
  MINVALUE 1000000
  MAXVALUE 9999999
  NO CYCLE;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  unique_id INTEGER NOT NULL UNIQUE DEFAULT nextval('user_unique_id_seq'),
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  profile_picture_url TEXT,
  udid VARCHAR(255),
  device_info JSONB,
  push_token TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'driving', 'offline')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_id ON users (unique_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized ON users (username_normalized);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

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

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes (email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes (expires_at);

CREATE TABLE IF NOT EXISTS api_logs (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255) UNIQUE NOT NULL,
  method VARCHAR(10) NOT NULL,
  url TEXT NOT NULL,
  path TEXT,
  status_code INTEGER,
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_body JSONB,
  response_body JSONB,
  duration_ms INTEGER,
  success BOOLEAN,
  status VARCHAR(20),
  message TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_request_id ON api_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_method_path ON api_logs(method, path);
CREATE INDEX IF NOT EXISTS idx_api_logs_status_code ON api_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_api_logs_success ON api_logs(success);

CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM api_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN users.unique_id IS '7-digit public ID for sharing and search (e.g. #1247190)';
COMMENT ON COLUMN users.username_normalized IS 'Lowercase username for case-insensitive uniqueness';