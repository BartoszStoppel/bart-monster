-- Feature requests / feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature'
    CHECK (category IN ('feature', 'bug', 'improvement')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'planned', 'in-progress', 'done', 'declined')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read feedback' AND tablename = 'feedback') THEN
    CREATE POLICY "Authenticated users can read feedback" ON feedback FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own feedback' AND tablename = 'feedback') THEN
    CREATE POLICY "Users can insert own feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own feedback' AND tablename = 'feedback') THEN
    CREATE POLICY "Users can delete own feedback" ON feedback FOR DELETE USING (auth.uid() = user_id AND status = 'new');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update feedback' AND tablename = 'feedback') THEN
    CREATE POLICY "Admins can update feedback" ON feedback FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    );
  END IF;
END $$;
