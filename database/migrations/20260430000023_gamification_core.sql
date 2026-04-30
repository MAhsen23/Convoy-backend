-- Gamification core: XP, levels, achievements (Phase 1: Driving, Convoy, Convoy Leader, Garage)

-- 1) User progression fields (fast reads)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS xp_total BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_updated_at TIMESTAMPTZ;

-- 2) XP event ledger (idempotency + audit)
CREATE TABLE IF NOT EXISTS xp_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points >= 0),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_created_at ON xp_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_event_type ON xp_events(event_type, created_at DESC);

-- 3) Aggregated stats (for progress + achievement evaluation)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_distance_km NUMERIC(14,3) NOT NULL DEFAULT 0,
  convoys_completed INTEGER NOT NULL DEFAULT 0,
  convoys_led_completed INTEGER NOT NULL DEFAULT 0,
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_stats_updated_at ON user_stats;
CREATE TRIGGER user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 4) Achievement catalog + unlocks
CREATE TABLE IF NOT EXISTS achievement_definitions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('driving', 'convoy', 'convoy_leader', 'garage')),
  title TEXT NOT NULL,
  description TEXT,
  badge_icon_url TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  metric_key TEXT NOT NULL,
  target_value NUMERIC NOT NULL CHECK (target_value >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS achievement_definitions_updated_at ON achievement_definitions;
CREATE TRIGGER achievement_definitions_updated_at
  BEFORE UPDATE ON achievement_definitions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE INDEX IF NOT EXISTS idx_achievements_active_category
  ON achievement_definitions(is_active, category, sort_order);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL REFERENCES achievement_definitions(key) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  PRIMARY KEY (user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked
  ON user_achievements(user_id, unlocked_at DESC);

-- Seed Phase-1 achievements (XP rewards are placeholders; tune later)
INSERT INTO achievement_definitions
  (key, category, title, description, badge_icon_url, xp_reward, metric_key, target_value, sort_order)
VALUES
  -- Driving (total_distance_km)
  ('driving_first_drive', 'driving', 'First Drive', 'Complete your first drive.', NULL, 50, 'total_distance_km', 0.1, 10),
  ('driving_50km', 'driving', 'Road Beginner', 'Drive 50 km in total.', NULL, 100, 'total_distance_km', 50, 20),
  ('driving_250km', 'driving', 'Road Explorer', 'Drive 250 km in total.', NULL, 250, 'total_distance_km', 250, 30),
  ('driving_1000km', 'driving', 'Road Warrior', 'Drive 1,000 km in total.', NULL, 500, 'total_distance_km', 1000, 40),
  ('driving_5000km', 'driving', 'High Mileage Driver', 'Drive 5,000 km in total.', NULL, 1000, 'total_distance_km', 5000, 50),
  ('driving_50000km', 'driving', 'Legendary Driver', 'Drive 50,000 km in total.', NULL, 5000, 'total_distance_km', 50000, 60),

  -- Convoy (convoys_completed)
  ('convoy_member', 'convoy', 'Convoy Member', 'Complete your first convoy.', NULL, 50, 'convoys_completed', 1, 10),
  ('convoy_team_player', 'convoy', 'Team Player', 'Complete 5 convoys.', NULL, 150, 'convoys_completed', 5, 20),
  ('convoy_veteran', 'convoy', 'Convoy Veteran', 'Complete 100 convoys.', NULL, 2000, 'convoys_completed', 100, 30),

  -- Convoy Leader (convoys_led_completed)
  ('leader_first', 'convoy_leader', 'Convoy Leader', 'Lead your first convoy.', NULL, 100, 'convoys_led_completed', 1, 10),
  ('leader_organizer_5', 'convoy_leader', 'Convoy Organizer', 'Lead 5 convoys.', NULL, 250, 'convoys_led_completed', 5, 20),
  ('leader_commander_10', 'convoy_leader', 'Convoy Commander', 'Lead 10 convoys.', NULL, 400, 'convoys_led_completed', 10, 30),
  ('leader_captain_25', 'convoy_leader', 'Convoy Captain', 'Lead 25 convoys.', NULL, 800, 'convoys_led_completed', 25, 40),
  ('leader_elite_50', 'convoy_leader', 'Convoy Elite Leader', 'Lead 50 convoys.', NULL, 1500, 'convoys_led_completed', 50, 50),
  ('leader_master_100', 'convoy_leader', 'Convoy Master', 'Lead 100 convoys.', NULL, 3000, 'convoys_led_completed', 100, 60),
  ('leader_legend_250', 'convoy_leader', 'Convoy Legend', 'Lead 250 convoys.', NULL, 6000, 'convoys_led_completed', 250, 70),
  ('leader_king_500', 'convoy_leader', 'Convoy King', 'Lead 500 convoys.', NULL, 12000, 'convoys_led_completed', 500, 80),

  -- Garage (vehicle_count)
  ('garage_owner', 'garage', 'Garage Owner', 'Add your first vehicle.', NULL, 50, 'vehicle_count', 1, 10),
  ('garage_collector_3', 'garage', 'Collector', 'Add 3 vehicles.', NULL, 100, 'vehicle_count', 3, 20),
  ('garage_master_5', 'garage', 'Garage Master', 'Add 5 vehicles.', NULL, 200, 'vehicle_count', 5, 30)
ON CONFLICT (key) DO NOTHING;

