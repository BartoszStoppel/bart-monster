-- Precomputed tier list alignment data.
-- Recomputed whenever any user saves their tier list or a game is deleted.
CREATE TABLE user_alignments (
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

CREATE POLICY "Auth users can read alignments" ON user_alignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can manage alignments" ON user_alignments
  FOR ALL USING (auth.role() = 'authenticated');
