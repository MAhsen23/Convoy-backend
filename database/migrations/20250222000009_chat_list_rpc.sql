-- Optimized direct conversation listing for a user
-- includes latest message, latest timestamp, unread_count, and other_user snapshot.
CREATE OR REPLACE FUNCTION get_direct_conversations_for_user(p_user_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  type TEXT,
  direct_user_one_id INTEGER,
  direct_user_two_id INTEGER,
  created_at TIMESTAMPTZ,
  latest_message TEXT,
  latest_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  other_user_id INTEGER,
  other_username TEXT,
  other_profile_picture_url TEXT,
  other_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.direct_user_one_id,
    c.direct_user_two_id,
    c.created_at,
    lm.content AS latest_message,
    lm.created_at AS latest_message_at,
    COALESCE(uc.unread_count, 0)::INTEGER AS unread_count,
    ou.id AS other_user_id,
    ou.username AS other_username,
    ou.profile_picture_url AS other_profile_picture_url,
    ou.status AS other_status
  FROM conversations c
  INNER JOIN conversation_members cm
    ON cm.conversation_id = c.id
   AND cm.user_id = p_user_id
  INNER JOIN users ou
    ON ou.id = CASE
      WHEN c.direct_user_one_id = p_user_id THEN c.direct_user_two_id
      ELSE c.direct_user_one_id
    END
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at
    FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM messages m2
    WHERE m2.conversation_id = c.id
      AND m2.sender_id <> p_user_id
      AND (
        cm.last_read_at IS NULL
        OR m2.created_at > cm.last_read_at
      )
  ) uc ON true
  WHERE c.type = 'direct'
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
END;
$$ LANGUAGE plpgsql STABLE;
