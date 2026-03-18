-- Add extended BGG data columns to board_games

-- People & credits
ALTER TABLE board_games ADD COLUMN designers TEXT[] DEFAULT '{}';
ALTER TABLE board_games ADD COLUMN artists TEXT[] DEFAULT '{}';
ALTER TABLE board_games ADD COLUMN publishers TEXT[] DEFAULT '{}';

-- Alternate names
ALTER TABLE board_games ADD COLUMN alternate_names TEXT[] DEFAULT '{}';

-- Expansions (array of {id, name} objects)
ALTER TABLE board_games ADD COLUMN expansions JSONB DEFAULT '[]';

-- Community stats
ALTER TABLE board_games ADD COLUMN bgg_users_rated INTEGER;
ALTER TABLE board_games ADD COLUMN bgg_std_dev NUMERIC(5,3);
ALTER TABLE board_games ADD COLUMN bgg_owned INTEGER;
ALTER TABLE board_games ADD COLUMN bgg_wanting INTEGER;
ALTER TABLE board_games ADD COLUMN bgg_wishing INTEGER;
ALTER TABLE board_games ADD COLUMN bgg_num_weights INTEGER;

-- Poll results
ALTER TABLE board_games ADD COLUMN suggested_players JSONB DEFAULT '[]';
ALTER TABLE board_games ADD COLUMN suggested_age INTEGER;
ALTER TABLE board_games ADD COLUMN language_dependence TEXT;
