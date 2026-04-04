CREATE TABLE IF NOT EXISTS user_activity (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  visit_count INTEGER NOT NULL DEFAULT 0,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read user_activity' AND tablename = 'user_activity') THEN
    CREATE POLICY "Authenticated users can read user_activity" ON user_activity FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own user_activity' AND tablename = 'user_activity') THEN
    CREATE POLICY "Users can insert own user_activity" ON user_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own user_activity' AND tablename = 'user_activity') THEN
    CREATE POLICY "Users can update own user_activity" ON user_activity FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Atomic upsert function for heartbeat tracking
CREATE OR REPLACE FUNCTION record_heartbeat(seconds INTEGER DEFAULT 0, is_visit BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
  INSERT INTO user_activity (user_id, visit_count, total_seconds, last_seen_at)
  VALUES (auth.uid(), CASE WHEN is_visit THEN 1 ELSE 0 END, seconds, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    visit_count = user_activity.visit_count + CASE WHEN is_visit THEN 1 ELSE 0 END,
    total_seconds = user_activity.total_seconds + seconds,
    last_seen_at = NOW();
$$ LANGUAGE sql SECURITY DEFINER;
