-- Expansion tier lists: admin-curated word bank + per-user rankings of a
-- game's expansions/DLC. The existing board_games.expansions JSONB column is
-- sourced from BGG and overwritten on re-fetch, so the curated, rankable set
-- lives in its own table here.

-- Word bank: which expansions are rankable for a game (admin-curated).
CREATE TABLE game_expansions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_bgg_id INTEGER NOT NULL REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- BGG's expansion id when picked from the fetched list; NULL for custom entries.
  bgg_expansion_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game_bgg_id, name)
);

CREATE INDEX idx_game_expansions_game ON game_expansions (game_bgg_id);

ALTER TABLE game_expansions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read game expansions" ON game_expansions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins may curate the word bank.
CREATE POLICY "Admins can manage game expansions" ON game_expansions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Per-user rankings of a game's expansions.
CREATE TABLE expansion_tier_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expansion_id UUID NOT NULL REFERENCES game_expansions(id) ON DELETE CASCADE,
  -- Denormalized for cheap per-game filtering and community aggregation.
  game_bgg_id INTEGER NOT NULL REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')),
  position INTEGER NOT NULL,
  score NUMERIC(4, 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, expansion_id)
);

CREATE INDEX idx_expansion_placements_game ON expansion_tier_placements (game_bgg_id);

ALTER TABLE expansion_tier_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read expansion placements" ON expansion_tier_placements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own expansion placements" ON expansion_tier_placements
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
