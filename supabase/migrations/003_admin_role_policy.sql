-- Allow admins to update is_admin on any profile
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Add email column to profiles so we can display it without auth.admin
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill from auth.users
UPDATE profiles SET email = u.email
  FROM auth.users u
  WHERE profiles.id = u.id AND profiles.email IS NULL;

-- Auto-set email on new profile creation
CREATE OR REPLACE FUNCTION set_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profile_set_email
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_profile_email();

-- Allow admins to delete games from the collection
CREATE POLICY "Admins can delete games" ON board_games
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
