-- Achievement: Jack the Ripper Got Away With It
INSERT INTO achievements (slug, title, description, icon)
VALUES (
  'jack-the-ripper',
  'Jack the Ripper',
  'Got away with it',
  '🔪'
);

INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, NULL
FROM profiles p, achievements a
WHERE p.email = 'bartosz.stoppel@gmail.com'
  AND a.slug = 'jack-the-ripper';

-- Bounties table: challenges no one has claimed yet
CREATE TABLE bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read bounties" ON bounties
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage bounties" ON bounties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Seed: Spirit Island difficulty 12 bounty
INSERT INTO bounties (slug, title, description, icon)
VALUES (
  'spirit-island-diff-12',
  'Spirit Island Difficulty 12',
  'Beat Spirit Island at difficulty 12',
  '🏝️'
);
