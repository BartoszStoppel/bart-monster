export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  is_admin: boolean;
  partner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BggExpansionRef {
  id: number;
  name: string;
}

export interface SuggestedPlayerCount {
  numPlayers: string;
  best: number;
  recommended: number;
  notRecommended: number;
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
  designers: string[];
  artists: string[];
  publishers: string[];
  alternate_names: string[];
  expansions: BggExpansionRef[];
  bgg_users_rated: number | null;
  bgg_std_dev: number | null;
  bgg_owned: number | null;
  bgg_wanting: number | null;
  bgg_wishing: number | null;
  bgg_num_weights: number | null;
  suggested_players: SuggestedPlayerCount[];
  suggested_age: number | null;
  language_dependence: string | null;
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

export type FeedbackCategory = "feature" | "bug" | "improvement";
export type FeedbackStatus = "new" | "planned" | "in-progress" | "done" | "declined";

export interface FeedbackItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackItemWithProfile extends FeedbackItem {
  profiles: Pick<Profile, "display_name" | "avatar_url">;
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
