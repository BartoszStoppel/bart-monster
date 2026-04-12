-- Award Twilight Imperium Q2 2026 champion to Robbie Lofland
INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, 'Q2 2026 champion'
FROM profiles p, achievements a
WHERE p.display_name = 'Robbie Lofland'
  AND a.slug = 'ti-quarterly-wins';
