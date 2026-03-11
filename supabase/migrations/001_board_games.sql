-- Profiles: basic user info synced from Google auth
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board games: cached data from BoardGameGeek
CREATE TABLE board_games (
  bgg_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  year_published INTEGER,
  min_players INTEGER,
  max_players INTEGER,
  playing_time INTEGER,
  min_play_time INTEGER,
  max_play_time INTEGER,
  min_age INTEGER,
  bgg_rating NUMERIC(4,2),
  bgg_weight NUMERIC(4,2),
  categories TEXT[] DEFAULT '{}',
  mechanics TEXT[] DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which users have which games in their collection
CREATE TABLE user_game_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bgg_id INTEGER REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  owned BOOLEAN DEFAULT TRUE,
  wishlist BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bgg_id)
);

-- User ratings for games (1-10)
CREATE TABLE game_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bgg_id INTEGER REFERENCES board_games(bgg_id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 10) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bgg_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_game_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_ratings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read everything
CREATE POLICY "Auth users can read profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read games" ON board_games
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read collections" ON user_game_collection
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can read ratings" ON game_ratings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can manage their own data
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Auth users can add games" ON board_games
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update games" ON board_games
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own collection" ON user_game_collection
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own ratings" ON game_ratings
  FOR ALL USING (auth.uid() = user_id);
