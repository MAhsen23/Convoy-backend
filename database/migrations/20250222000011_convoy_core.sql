-- Convoy core (create/join/leave/end + invites)

-- Extend user status for convoy presence
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('online', 'driving', 'in_convoy', 'offline'));

CREATE TABLE IF NOT EXISTS convoys (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) NOT NULL UNIQUE,
  name TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  max_members INTEGER NOT NULL DEFAULT 15 CHECK (max_members >= 2 AND max_members <= 50),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convoys_status_started_at ON convoys(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_convoys_created_by ON convoys(created_by);

DROP TRIGGER IF EXISTS convoys_updated_at ON convoys;
CREATE TRIGGER convoys_updated_at
  BEFORE UPDATE ON convoys
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE IF NOT EXISTS convoy_members (
  id SERIAL PRIMARY KEY,
  convoy_id INTEGER NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_convoy_members_unique_active
  ON convoy_members(convoy_id, user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_convoy_members_user_active
  ON convoy_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_convoy_members_convoy_active
  ON convoy_members(convoy_id, status);

CREATE TABLE IF NOT EXISTS convoy_invites (
  id SERIAL PRIMARY KEY,
  convoy_id INTEGER NOT NULL REFERENCES convoys(id) ON DELETE CASCADE,
  inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT convoy_invites_no_self CHECK (inviter_id <> invitee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_convoy_invites_unique_pending
  ON convoy_invites(convoy_id, invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_convoy_invites_invitee_pending
  ON convoy_invites(invitee_id, status, created_at DESC);

COMMENT ON TABLE convoys IS 'Active/ended convoys. Created by a user and joined via code/invite.';
COMMENT ON TABLE convoy_members IS 'Membership and role in a convoy.';
COMMENT ON TABLE convoy_invites IS 'Invite workflow for joining convoys.';
