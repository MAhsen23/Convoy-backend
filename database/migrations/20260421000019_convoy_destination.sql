-- Optional convoy destination (used for navigation / map target)

ALTER TABLE convoys
  ADD COLUMN IF NOT EXISTS destination_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS destination_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS destination_name TEXT,
  ADD COLUMN IF NOT EXISTS destination_address TEXT,
  ADD COLUMN IF NOT EXISTS destination_place_id TEXT,
  ADD COLUMN IF NOT EXISTS destination_updated_at TIMESTAMPTZ;

ALTER TABLE convoys DROP CONSTRAINT IF EXISTS convoys_destination_lat_lng_pair;
ALTER TABLE convoys
  ADD CONSTRAINT convoys_destination_lat_lng_pair
  CHECK ((destination_lat IS NULL) = (destination_lng IS NULL));

COMMENT ON COLUMN convoys.destination_lat IS 'Optional destination latitude (WGS84).';
COMMENT ON COLUMN convoys.destination_lng IS 'Optional destination longitude (WGS84).';
COMMENT ON COLUMN convoys.destination_name IS 'Optional destination label (place/business name).';
COMMENT ON COLUMN convoys.destination_address IS 'Optional human-readable destination address.';
COMMENT ON COLUMN convoys.destination_place_id IS 'Optional external provider place id (Google/Apple/etc).';
COMMENT ON COLUMN convoys.destination_updated_at IS 'Timestamp when destination was last set/updated/cleared.';
