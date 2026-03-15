-- Remove duplicate score from description (detail field already shows "111 points")
UPDATE achievements
SET description = 'Highest Wingspan score'
WHERE slug = 'wingspan-high-score';
