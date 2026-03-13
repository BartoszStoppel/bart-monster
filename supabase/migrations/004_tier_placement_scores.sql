-- Add normalized score column to tier_placements
-- Score is 1-10, computed from tier ordering when user saves
ALTER TABLE tier_placements
ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 1 AND score <= 10);
