-- Step 1a: Add admin role to profiles
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

UPDATE profiles SET is_admin = TRUE
  WHERE id = (SELECT id FROM auth.users WHERE email = 'bartosz.stoppel@gmail.com');

-- Step 1b: Add category to board_games
ALTER TABLE board_games ADD COLUMN category TEXT CHECK (category IN ('party', 'board'));

UPDATE board_games SET category = 'board';

ALTER TABLE board_games ALTER COLUMN category SET NOT NULL;

-- Step 1c: Trigger to restrict category changes to admins
CREATE OR REPLACE FUNCTION check_category_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.category IS DISTINCT FROM NEW.category THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
      RAISE EXCEPTION 'Only admins can change game category';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_category_admin
  BEFORE UPDATE ON board_games
  FOR EACH ROW EXECUTE FUNCTION check_category_update();

-- Step 1d: Tier placements table
CREATE TABLE tier_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bgg_id INTEGER REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')),
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bgg_id)
);

ALTER TABLE tier_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read tier placements" ON tier_placements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own tier placements" ON tier_placements
  FOR ALL USING (auth.uid() = user_id);
