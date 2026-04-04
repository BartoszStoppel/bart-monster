INSERT INTO bounties (slug, title, description, icon)
VALUES
  ('scythe-score-100', 'Scythe: Score 100+', 'Score 100 or more points in a single game of Scythe', '⚙️'),
  ('frostpunk-no-deaths', 'Frostpunk: Flawless Run', 'Survive Frostpunk without losing a single citizen', '❄️'),
  ('ti4-14-point-win', 'Twilight Imperium: Full Victory', 'Win a full 14-point game of Twilight Imperium', '🌌')
ON CONFLICT (slug) DO NOTHING;
