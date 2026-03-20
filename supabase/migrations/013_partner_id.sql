-- Add partner_id to profiles for shared collections between married couples
ALTER TABLE profiles ADD COLUMN partner_id UUID REFERENCES profiles(id);

-- Seed known married couples
-- Robert Lofland & Sydney O'Day
UPDATE profiles SET partner_id = (SELECT id FROM profiles WHERE display_name = 'Sydney O''Day') WHERE display_name = 'Robbie Lofland';
UPDATE profiles SET partner_id = (SELECT id FROM profiles WHERE display_name = 'Robbie Lofland') WHERE display_name = 'Sydney O''Day';

-- Bartosz Stoppel & Maddie Risner
UPDATE profiles SET partner_id = (SELECT id FROM profiles WHERE display_name = 'Maddie Risner') WHERE display_name = 'Bartosz Stoppel';
UPDATE profiles SET partner_id = (SELECT id FROM profiles WHERE display_name = 'Bartosz Stoppel') WHERE display_name = 'Maddie Risner';
