-- Bounty: Slay the Spire Ascension 13 heart kill
INSERT INTO bounties (slug, title, description, icon)
VALUES (
  'sts-ascension-13-heart',
  'Slay the Spire: Ascension 13 Heart Kill',
  'Beat Ascension 13 with a heart kill in Slay the Spire',
  '🗡️'
);

-- Achievement: Highest Ascension in Slay the Spire
INSERT INTO achievements (slug, title, description, icon)
VALUES (
  'sts-highest-ascension',
  'Slay the Spire: Highest Ascension',
  'Highest ascension beaten with a heart kill',
  '🃏'
);

INSERT INTO user_achievements (user_id, achievement_id, detail)
SELECT p.id, a.id, 'Ascension 9 with heart kill'
FROM profiles p, achievements a
WHERE a.slug = 'sts-highest-ascension'
  AND p.email IN (
    'bartosz.stoppel@gmail.com',
    'risnerm12@gmail.com',
    'rogiers19@gmail.com',
    'jthomasmmail@gmail.com'
  );
