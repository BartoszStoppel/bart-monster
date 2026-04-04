INSERT INTO bounties (slug, title, description, icon)
VALUES (
  'camel-up-50-gold',
  'Camel Up: 50 Gold',
  'Finish a game of Camel Up with 50 or more gold',
  '🐪'
) ON CONFLICT (slug) DO NOTHING;
