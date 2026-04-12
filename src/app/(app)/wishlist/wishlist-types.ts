import type { BoardGame } from "@/types/database";

export interface ProfileInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WishlistItem {
  game: BoardGame;
  priority: number | null;
  note: string | null;
  otherWishlisters: ProfileInfo[];
  owners: ProfileInfo[];
}

export interface SuggestedGame {
  game: BoardGame;
  matchScore: number;
  matchingMechanics: string[];
  matchingCategories: string[];
}

export type WishlistSortOption = "name" | "bgg-rating" | "weight" | "priority" | "players";
export type CategoryFilter = "all" | "board" | "party";
