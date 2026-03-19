ALTER TABLE convoys DROP CONSTRAINT IF EXISTS convoys_status_check;
ALTER TABLE convoys
  ADD CONSTRAINT convoys_status_check
  CHECK (status IN ('active', 'started', 'ended'));
