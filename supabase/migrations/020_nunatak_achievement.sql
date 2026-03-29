INSERT INTO achievements (slug, title, description, icon)
VALUES (
  'nunatak-high-score',
  'Nunatak: High Score',
  'Highest score in Nunatak: Temple of Ice',
  '🏔️'
);

INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, '141 pts'
FROM profiles p, achievements a
WHERE p.email = 'risnerm12@gmail.com'
  AND a.slug = 'nunatak-high-score';
