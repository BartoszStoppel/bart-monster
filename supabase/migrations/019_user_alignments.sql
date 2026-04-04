-- Precomputed tier list alignment data.
-- Recomputed whenever any user saves their tier list or a game is deleted.
CREATE TABLE IF NOT EXISTS user_alignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('board', 'party')),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  allies JSONB NOT NULL DEFAULT '[]',
  rivals JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

ALTER TABLE user_alignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can read alignments' AND tablename = 'user_alignments') THEN
    CREATE POLICY "Auth users can read alignments" ON user_alignments FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can insert alignments' AND tablename = 'user_alignments') THEN
    CREATE POLICY "Auth users can insert alignments" ON user_alignments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can update alignments' AND tablename = 'user_alignments') THEN
    CREATE POLICY "Auth users can update alignments" ON user_alignments FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can delete alignments' AND tablename = 'user_alignments') THEN
    CREATE POLICY "Auth users can delete alignments" ON user_alignments FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;
