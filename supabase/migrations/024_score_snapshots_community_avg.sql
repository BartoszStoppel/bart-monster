-- Allow NULL user_id for community average snapshots
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'score_snapshots' AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE score_snapshots DROP CONSTRAINT IF EXISTS score_snapshots_user_id_fkey;
    ALTER TABLE score_snapshots ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE score_snapshots
      ADD CONSTRAINT score_snapshots_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE score_snapshots IS 'user_id = NULL means community average snapshot';
