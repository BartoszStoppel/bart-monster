INSERT INTO bounties (slug, title, description, icon)
VALUES (
  'hegemony-score-175',
  'Hegemony: Score 175',
  'Score 175 points in Hegemony',
  '🏛️'
) ON CONFLICT (slug) DO NOTHING;
