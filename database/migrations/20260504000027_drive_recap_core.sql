-- Drive recap: post-convoy summary for map route, stats, XP, and achievements (Phase 1 MVP)
CREATE TABLE IF NOT EXISTS drive_recaps (
  id BIGSERIAL PRIMARY KEY,
  convoy_id INTEGER NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  distance_km NUMERIC(12, 3) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  average_speed_kmh NUMERIC(8, 2),
  convoy_size INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  achievements_unlocked JSONB NOT NULL DEFAULT '[]'::jsonb,
  route_coordinates JSONB,
  destination JSONB,
  convoy_name TEXT,
  convoy_code TEXT,
  role TEXT CHECK (role IN ('leader', 'member')),
  share_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (convoy_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_recaps_user_created
  ON drive_recaps(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drive_recaps_convoy
  ON drive_recaps(convoy_id);

DROP TRIGGER IF EXISTS drive_recaps_updated_at ON drive_recaps;
CREATE TRIGGER drive_recaps_updated_at
  BEFORE UPDATE ON drive_recaps
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

COMMENT ON TABLE drive_recaps IS 'Per-user drive recap after convoy ends; powers recap screen and share card data.';
COMMENT ON COLUMN drive_recaps.route_coordinates IS 'JSON array of {lat, lng, recorded_at?} for map polyline.';
COMMENT ON COLUMN drive_recaps.achievements_unlocked IS 'JSON array of achievements unlocked during this drive.';
