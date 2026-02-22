ALTER TABLE users ADD COLUMN IF NOT EXISTS udid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

DROP TABLE IF EXISTS api_logs;

CREATE TABLE api_logs (
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
