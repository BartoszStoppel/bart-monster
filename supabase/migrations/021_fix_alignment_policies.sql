-- Fix alignment RLS policies: the original migration (019) had a single FOR ALL
-- policy that was later edited in-place but never re-applied to production.
-- This migration ensures production has the correct granular policies.

DROP POLICY IF EXISTS "Auth users can manage alignments" ON user_alignments;
DROP POLICY IF EXISTS "Auth users can insert alignments" ON user_alignments;
DROP POLICY IF EXISTS "Auth users can update alignments" ON user_alignments;
DROP POLICY IF EXISTS "Auth users can delete alignments" ON user_alignments;

CREATE POLICY "Auth users can insert alignments" ON user_alignments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update alignments" ON user_alignments
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete alignments" ON user_alignments
  FOR DELETE USING (auth.role() = 'authenticated');
