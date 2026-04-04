-- Historical score snapshots, logged each time a user saves their tier list
CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bgg_id INTEGER NOT NULL REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_bgg ON score_snapshots (bgg_id, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_user ON score_snapshots (user_id, bgg_id);

ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read score_snapshots' AND tablename = 'score_snapshots') THEN
    CREATE POLICY "Authenticated users can read score_snapshots" ON score_snapshots FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own score_snapshots' AND tablename = 'score_snapshots') THEN
    CREATE POLICY "Users can insert own score_snapshots" ON score_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
