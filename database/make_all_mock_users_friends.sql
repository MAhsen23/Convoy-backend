-- Query to accept all pending friend requests automatically for testing
UPDATE friend_requests
SET status = 'accepted', responded_at = NOW()
WHERE status = 'pending';

-- Query to make all users friends with each other
DO $$
DECLARE
  rec1 RECORD;
  rec2 RECORD;
BEGIN
  -- Loop through all existing users and make them friends with every other user
  FOR rec1 IN SELECT id FROM users LOOP
    FOR rec2 IN SELECT id FROM users LOOP
      IF rec1.id < rec2.id THEN
        -- Insert a friendship dynamically via the unified order
        INSERT INTO friendships (user_one_id, user_two_id)
        VALUES (rec1.id, rec2.id)
        ON CONFLICT (user_one_id, user_two_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;
