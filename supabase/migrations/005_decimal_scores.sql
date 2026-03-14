-- Change score column from INTEGER to NUMERIC(3,1) for decimal scoring
ALTER TABLE tier_placements
  DROP CONSTRAINT IF EXISTS tier_placements_score_check;

ALTER TABLE tier_placements
  ALTER COLUMN score TYPE NUMERIC(3,1) USING score::NUMERIC(3,1);

ALTER TABLE tier_placements
  ADD CONSTRAINT tier_placements_score_check CHECK (score >= 1.0 AND score <= 10.0);
