INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, NULL
FROM profiles p, achievements a
WHERE p.email = 'holdenjohnson97@gmail.com'
  AND a.slug = 'jack-the-ripper';
