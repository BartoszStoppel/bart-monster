-- Achievement: Wingspan high score of 111
INSERT INTO achievements (slug, title, description, icon)
VALUES (
  'wingspan-high-score',
  'Wingspan High Flyer',
  'Highest Wingspan score — 111 points',
  '🦅'
);

-- Award to Bartosz Stoppel
INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, '111 points'
FROM profiles p, achievements a
WHERE p.email = 'bartosz.stoppel@gmail.com'
  AND a.slug = 'wingspan-high-score';
