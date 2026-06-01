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
  wishlist_priority: number | null;
  wishlist_note: string | null;
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

export type RulesModuleType = "base" | "expansion";

/** Uploaded rulebook content for one module (base game or a single expansion). */
export interface GameRulesModule {
  id: string;
  bgg_id: number;
  module_name: string;
  module_type: RulesModuleType;
  content_md: string;
  token_estimate: number | null;
  source: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RulesCitation {
  /** "rulebook" | "bgg_forum" | "reddit" | "web" */
  source_type: string;
  /** Human-readable label, e.g. rulebook section heading or thread title. */
  label: string;
  /** URL for external sources; null for the loaded rulebook. */
  url: string | null;
}

export interface RulesAnswerCacheRow {
  id: string;
  bgg_id: number;
  modules_hash: string;
  question_norm: string;
  answer_md: string;
  citations: RulesCitation[];
  created_at: string;
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

/** An expansion/DLC that admins have added to a game's rankable word bank. */
export interface GameExpansion {
  id: string;
  game_bgg_id: number;
  name: string;
  /** BGG's expansion id when picked from the fetched list; null for custom entries. */
  bgg_expansion_id: number | null;
  /** BGG box-art thumbnail; null for custom entries (tiles fall back to the name). */
  thumbnail_url: string | null;
  created_at: string;
}

/** A user's tier placement for a single game expansion. */
export interface ExpansionTierPlacement {
  id: string;
  user_id: string;
  expansion_id: string;
  game_bgg_id: number;
  tier: Tier;
  position: number;
  score: number | null;
  created_at: string;
  updated_at: string;
}
