ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS convoy_id INTEGER REFERENCES convoys(id) ON DELETE CASCADE;

ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_direct_pair_check;

ALTER TABLE conversations
ADD CONSTRAINT conversations_type_shape_check CHECK (
  (
    type = 'direct'
    AND direct_user_one_id IS NOT NULL
    AND direct_user_two_id IS NOT NULL
    AND direct_user_one_id < direct_user_two_id
    AND convoy_id IS NULL
  )
  OR
  (
    type = 'group'
    AND direct_user_one_id IS NULL
    AND direct_user_two_id IS NULL
    AND convoy_id IS NULL
  )
  OR
  (
    type = 'convoy'
    AND direct_user_one_id IS NULL
    AND direct_user_two_id IS NULL
    AND convoy_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_convoy
  ON conversations(convoy_id) WHERE type = 'convoy';
