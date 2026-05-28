-- Crowdsourced hazards (community reports)

CREATE TABLE IF NOT EXISTS hazard_types (
  type TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon_url TEXT,
  default_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  confirm_extend_minutes INTEGER NOT NULL DEFAULT 30,
  max_ttl_minutes INTEGER NOT NULL DEFAULT 360,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO hazard_types (type, label, default_ttl_minutes, confirm_extend_minutes, max_ttl_minutes, sort_order)
VALUES
  ('speed_camera', 'Speed camera', 240, 60, 720, 10),
  ('police', 'Police control', 60, 30, 180, 20),
  ('accident', 'Accident', 120, 45, 360, 30),
  ('road_hazard', 'Road hazard', 90, 30, 240, 40),
  ('construction', 'Construction', 480, 120, 1440, 50),
  ('traffic', 'Traffic incident', 90, 30, 240, 60)
ON CONFLICT (type) DO NOTHING;

CREATE TABLE IF NOT EXISTS hazard_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL REFERENCES hazard_types(type),
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  heading NUMERIC(6, 2),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed')),
  confirm_count INTEGER NOT NULL DEFAULT 0,
  reject_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  last_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hazard_reports_active_expires
  ON hazard_reports(status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_hazard_reports_bbox
  ON hazard_reports(lat, lng) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_hazard_reports_reporter_created
  ON hazard_reports(reporter_id, created_at DESC);

DROP TRIGGER IF EXISTS hazard_reports_updated_at ON hazard_reports;
CREATE TRIGGER hazard_reports_updated_at
  BEFORE UPDATE ON hazard_reports
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS hazard_votes (
  hazard_id INTEGER NOT NULL REFERENCES hazard_reports(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('confirm', 'reject')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hazard_id, user_id)
);

DROP TRIGGER IF EXISTS hazard_votes_updated_at ON hazard_votes;
CREATE TRIGGER hazard_votes_updated_at
  BEFORE UPDATE ON hazard_votes
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
