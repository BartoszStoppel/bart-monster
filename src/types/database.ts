export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardGame {
  bgg_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  playing_time: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
  min_age: number | null;
  bgg_rating: number | null;
  bgg_weight: number | null;
  categories: string[];
  mechanics: string[];
  category: "party" | "board";
  fetched_at: string;
  created_at: string;
}

export interface UserGameCollection {
  id: string;
  user_id: string;
  bgg_id: number;
  owned: boolean;
  wishlist: boolean;
  added_at: string;
}

export interface GameRating {
  id: string;
  user_id: string;
  bgg_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameRatingWithProfile extends GameRating {
  profiles: Profile;
}

export type Tier = "S" | "A" | "B" | "C" | "D" | "F";

export interface TierPlacement {
  id: string;
  user_id: string;
  bgg_id: number;
  tier: Tier;
  position: number;
  score: number | null;
  created_at: string;
  updated_at: string;
}
