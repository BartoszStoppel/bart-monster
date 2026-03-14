-- Achievements: manually awarded achievements for users
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join table: which users hold which achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  detail TEXT,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read achievements
CREATE POLICY "Auth users can read achievements" ON achievements
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read user_achievements" ON user_achievements
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can manage achievements
CREATE POLICY "Admins can manage achievements" ON achievements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
CREATE POLICY "Admins can manage user_achievements" ON user_achievements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Seed: Twilight Imperium quarterly wins achievement
INSERT INTO achievements (slug, title, description, icon)
VALUES (
  'ti-quarterly-wins',
  'Twilight Imperium Champion',
  'Most quarterly Twilight Imperium wins',
  '👑'
);

-- Award to Thomas Monzingo
INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, 'Q1 2026 champion'
FROM profiles p, achievements a
WHERE p.email = 'thomas.monzingo@gmail.com'
  AND a.slug = 'ti-quarterly-wins';
