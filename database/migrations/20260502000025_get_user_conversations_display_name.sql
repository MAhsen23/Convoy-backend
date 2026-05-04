-- Add other_display_name to get_user_conversations RPC
-- DROP first (return type change requires full recreate)
DROP FUNCTION IF EXISTS get_user_conversations(INTEGER);

CREATE FUNCTION get_user_conversations(p_user_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  type TEXT,
  direct_user_one_id INTEGER,
  direct_user_two_id INTEGER,
  convoy_id INTEGER,
  created_at TIMESTAMPTZ,
  latest_message TEXT,
  latest_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  other_user_id INTEGER,
  other_username TEXT,
  other_display_name TEXT,
  other_profile_picture_url TEXT,
  other_status TEXT,
  convoy_code VARCHAR(20),
  convoy_name TEXT,
  convoy_icon TEXT,
  convoy_status TEXT,
  convoy_max_members INTEGER,
  convoy_started_at TIMESTAMPTZ,
  convoy_ended_at TIMESTAMPTZ,
  convoy_created_at TIMESTAMPTZ
) AS $func$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.type,
    c.direct_user_one_id,
    c.direct_user_two_id,
    c.convoy_id,
    c.created_at,
    lm.content AS latest_message,
    lm.created_at AS latest_message_at,
    COALESCE(uc.unread_count, 0)::INTEGER AS unread_count,
    ou.id AS other_user_id,
    ou.username AS other_username,
    ou.display_name AS other_display_name,
    ou.profile_picture_url AS other_profile_picture_url,
    ou.status AS other_status,
    cv.code AS convoy_code,
    cv.name AS convoy_name,
    cv.icon_url AS convoy_icon,
    cv.status AS convoy_status,
    cv.max_members AS convoy_max_members,
    cv.started_at AS convoy_started_at,
    cv.ended_at AS convoy_ended_at,
    cv.created_at AS convoy_created_at
  FROM conversation_members cm
  INNER JOIN conversations c
    ON c.id = cm.conversation_id
  LEFT JOIN users ou
    ON c.type = 'direct'
   AND ou.id = CASE
      WHEN c.direct_user_one_id = p_user_id THEN c.direct_user_two_id
      ELSE c.direct_user_one_id
    END
  LEFT JOIN convoys cv
    ON c.type = 'convoy'
   AND cv.id = c.convoy_id
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
      AND (cm.last_read_at IS NULL OR m2.created_at > cm.last_read_at)
  ) uc ON true
  WHERE cm.user_id = p_user_id
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
END;
$func$ LANGUAGE plpgsql STABLE;
