-- Garage: vehicles belong to a user. One primary vehicle per user (visible in profile, convoys, chats).
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  power TEXT,
  fuel_type TEXT,
  modifications TEXT,
  image_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_one_primary_per_user ON vehicles(user_id) WHERE is_primary = true;

DROP TRIGGER IF EXISTS vehicles_updated_at ON vehicles;
CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE OR REPLACE FUNCTION vehicles_clear_other_primary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE vehicles SET is_primary = false WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vehicles_before_primary ON vehicles;
CREATE TRIGGER vehicles_before_primary
  AFTER INSERT OR UPDATE OF is_primary ON vehicles
  FOR EACH ROW WHEN (NEW.is_primary = true)
  EXECUTE PROCEDURE vehicles_clear_other_primary();

COMMENT ON TABLE vehicles IS 'User garage. One vehicle per user can be is_primary (shown in profile, convoys, chats).';
