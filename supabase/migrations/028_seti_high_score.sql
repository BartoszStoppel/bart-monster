-- Achievement: SETI high score of 160
INSERT INTO achievements (slug, title, description, icon)
VALUES (
  'seti-high-score',
  'SETI High Score',
  'Highest SETI score — 160 points',
  '📡'
);

-- Award to Robbie Lofland
INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, '160 points'
FROM profiles p, achievements a
WHERE p.display_name = 'Robbie Lofland'
  AND a.slug = 'seti-high-score';
