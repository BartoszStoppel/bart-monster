-- Rules assistant: uploaded rulebooks (per module), answer cache, and agent run log.

-- Uploaded rulebook content, one row per module (base game or expansion).
CREATE TABLE IF NOT EXISTS game_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bgg_id INTEGER NOT NULL REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  module_type TEXT NOT NULL DEFAULT 'base'
    CHECK (module_type IN ('base', 'expansion')),
  content_md TEXT NOT NULL,
  token_estimate INTEGER,
  source TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bgg_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_game_rules_bgg_id ON game_rules (bgg_id);

ALTER TABLE game_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read game rules' AND tablename = 'game_rules') THEN
    CREATE POLICY "Authenticated users can read game rules" ON game_rules FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert game rules' AND tablename = 'game_rules') THEN
    CREATE POLICY "Admins can insert game rules" ON game_rules FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update game rules' AND tablename = 'game_rules') THEN
    CREATE POLICY "Admins can update game rules" ON game_rules FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete game rules' AND tablename = 'game_rules') THEN
    CREATE POLICY "Admins can delete game rules" ON game_rules FOR DELETE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    );
  END IF;
END $$;

-- Cached rules-agent answers, keyed by game + the set of modules in play + the normalized question.
CREATE TABLE IF NOT EXISTS rules_answer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bgg_id INTEGER NOT NULL REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  modules_hash TEXT NOT NULL,
  question_norm TEXT NOT NULL,
  answer_md TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bgg_id, modules_hash, question_norm)
);

CREATE INDEX IF NOT EXISTS idx_rules_answer_cache_lookup
  ON rules_answer_cache (bgg_id, modules_hash, question_norm);

ALTER TABLE rules_answer_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read answer cache' AND tablename = 'rules_answer_cache') THEN
    CREATE POLICY "Authenticated users can read answer cache" ON rules_answer_cache FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can write answer cache' AND tablename = 'rules_answer_cache') THEN
    CREATE POLICY "Authenticated users can write answer cache" ON rules_answer_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete answer cache' AND tablename = 'rules_answer_cache') THEN
    CREATE POLICY "Admins can delete answer cache" ON rules_answer_cache FOR DELETE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    );
  END IF;
END $$;

-- Drop a game's cached answers automatically whenever its rulebook content changes.
CREATE OR REPLACE FUNCTION invalidate_rules_answer_cache() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM rules_answer_cache WHERE bgg_id = COALESCE(NEW.bgg_id, OLD.bgg_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invalidate_rules_answer_cache ON game_rules;
CREATE TRIGGER trg_invalidate_rules_answer_cache
  AFTER INSERT OR UPDATE OR DELETE ON game_rules
  FOR EACH ROW EXECUTE FUNCTION invalidate_rules_answer_cache();

-- Debug/audit log of rules-agent runs.
CREATE TABLE IF NOT EXISTS rules_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bgg_id INTEGER REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer_md TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rules_agent_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own agent runs' AND tablename = 'rules_agent_runs') THEN
    CREATE POLICY "Users can insert own agent runs" ON rules_agent_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read agent runs' AND tablename = 'rules_agent_runs') THEN
    CREATE POLICY "Admins can read agent runs" ON rules_agent_runs FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
    );
  END IF;
END $$;
