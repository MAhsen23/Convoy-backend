ALTER TABLE convoys
  ADD COLUMN IF NOT EXISTS icon_url TEXT;

COMMENT ON COLUMN convoys.icon_url IS 'Optional convoy icon image URL.';

