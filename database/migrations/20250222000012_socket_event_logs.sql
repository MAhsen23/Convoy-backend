CREATE TABLE IF NOT EXISTS socket_event_logs (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    direction VARCHAR(20) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    socket_id VARCHAR(255),
    user_id INTEGER REFERENCES users(id),
    room VARCHAR(255),
    target_user_ids INTEGER[],
    conversation_id INTEGER,
    convoy_id INTEGER,
    payload JSONB,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socket_event_logs_event_id ON socket_event_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_socket_event_logs_direction ON socket_event_logs(direction);
CREATE INDEX IF NOT EXISTS idx_socket_event_logs_event_name ON socket_event_logs(event_name);
CREATE INDEX IF NOT EXISTS idx_socket_event_logs_user_id ON socket_event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_socket_event_logs_created_at ON socket_event_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_socket_event_logs_conversation_id ON socket_event_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_socket_event_logs_convoy_id ON socket_event_logs(convoy_id);

CREATE OR REPLACE FUNCTION cleanup_old_socket_event_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM socket_event_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
