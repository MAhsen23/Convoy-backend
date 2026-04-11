ALTER TABLE convoy_members
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12, 3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN convoy_members.distance_km IS 'Tracked ride distance (km) for this membership; set when convoy ends.';
