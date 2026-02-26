-- Social graph + 1:1 chat core for MVP

CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT friend_requests_no_self CHECK (sender_id <> receiver_id)
);

-- Only one pending request per direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_unique_pending_direction
  ON friend_requests(sender_id, receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_pending
  ON friend_requests(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender
  ON friend_requests(sender_id, created_at DESC);

-- Friendship pairs are stored in canonical order: user_one_id < user_two_id
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_one_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_two_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_canonical_order CHECK (user_one_id < user_two_id),
  CONSTRAINT friendships_no_self CHECK (user_one_id <> user_two_id),
  CONSTRAINT friendships_unique_pair UNIQUE (user_one_id, user_two_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_one_id ON friendships(user_one_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_two_id ON friendships(user_two_id);

-- Chat conversations (MVP: direct; ready for group/convoy)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'convoy')),
  created_by INTEGER REFERENCES users(id),
  direct_user_one_id INTEGER REFERENCES users(id),
  direct_user_two_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_direct_pair_check CHECK (
    (type = 'direct' AND direct_user_one_id IS NOT NULL AND direct_user_two_id IS NOT NULL AND direct_user_one_id < direct_user_two_id)
    OR
    (type <> 'direct' AND direct_user_one_id IS NULL AND direct_user_two_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_direct_pair
  ON conversations(direct_user_one_id, direct_user_two_id) WHERE type = 'direct';
CREATE INDEX IF NOT EXISTS idx_conversations_type_created_at ON conversations(type, created_at DESC);

-- Members of a conversation
CREATE TABLE IF NOT EXISTS conversation_members (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  CONSTRAINT conversation_members_unique UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
  ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

COMMENT ON TABLE friend_requests IS 'Pending/accepted/rejected friend requests.';
COMMENT ON TABLE friendships IS 'Crew/friend relation stored as unique canonical pairs.';
COMMENT ON TABLE conversations IS 'Chat containers: direct/group/convoy.';
COMMENT ON TABLE conversation_members IS 'Conversation membership and read state.';
COMMENT ON TABLE messages IS 'Chat messages with optional metadata.';
