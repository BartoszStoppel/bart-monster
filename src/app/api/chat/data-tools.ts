import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ToolInput {
  order_by?: string;
  limit?: number;
  category?: string;
  max_players_gte?: number;
  max_time?: number;
  min_weight?: number;
  max_weight?: number;
  game_names?: string[];
  compare_against?: "bgg" | "community";
  direction?: "user_higher" | "user_lower" | "both";
  min_difference?: number;
}

/** Tool definitions given to the query-planning model. */
export const DATA_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_user_rankings",
    description:
      "Get the current user's ranked games with their tier, score (1-10), the game's BGG rating, and the community average score. Returns ALL ranked games by default. Use this for any question about the user's ratings, preferences, or taste analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        order_by: {
          type: "string",
          enum: ["score_desc", "score_asc", "name"],
          description: "Sort order. Default: score_desc",
        },
        limit: {
          type: "number",
          description:
            "Max games to return. Omit to return ALL. Only set this for 'top N' or 'bottom N' questions.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_collection",
    description:
      "Get games in the collection with metadata (player count, play time, weight, BGG rating, category, mechanics, categories). Use this for recommendations, filtering by attributes, or browsing.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["party", "board"],
          description: "Filter by category",
        },
        max_players_gte: {
          type: "number",
          description: "Games supporting at least this many players",
        },
        max_time: {
          type: "number",
          description: "Max playing time in minutes",
        },
        min_weight: {
          type: "number",
          description: "Minimum BGG weight (1-5)",
        },
        max_weight: {
          type: "number",
          description: "Maximum BGG weight (1-5)",
        },
        order_by: {
          type: "string",
          enum: ["name", "bgg_rating_desc", "weight_desc", "weight_asc", "time_asc", "time_desc"],
          description: "Sort order. Default: name",
        },
        limit: {
          type: "number",
          description: "Max games to return. Omit for all.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_community_rankings",
    description:
      "Get community average scores (from 3+ tier lists) for games. Use for questions about what the group thinks, group favorites, or consensus ratings.",
    input_schema: {
      type: "object" as const,
      properties: {
        order_by: {
          type: "string",
          enum: ["avg_desc", "avg_asc", "name"],
          description: "Sort order. Default: avg_desc",
        },
        limit: {
          type: "number",
          description: "Max games to return. Omit for all.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_game_details",
    description:
      "Get full details for specific games by name. Use when the user asks about particular games.",
    input_schema: {
      type: "object" as const,
      properties: {
        game_names: {
          type: "array",
          items: { type: "string" },
          description: "Game names to look up (case-insensitive partial match)",
        },
      },
      required: ["game_names"],
    },
  },
  {
    name: "compare_scores",
    description:
      "Compare the user's scores against BGG ratings or community averages. Returns ONLY games matching the comparison with the difference pre-computed and sorted. Use this whenever the user asks about disparities, differences, over/underrated games, or 'which games do I rate higher/lower than X'.",
    input_schema: {
      type: "object" as const,
      properties: {
        compare_against: {
          type: "string",
          enum: ["bgg", "community"],
          description:
            "What to compare the user's score against. 'bgg' = BGG's global rating (from millions of users worldwide). 'community' = the friend group's average score on bart.monster (from 3+ tier lists).",
        },
        direction: {
          type: "string",
          enum: ["user_higher", "user_lower", "both"],
          description:
            "Which rows to include. 'user_higher' = user score > comparison. 'user_lower' = user score < comparison. 'both' = all games with a difference.",
        },
        min_difference: {
          type: "number",
          description:
            "Minimum absolute difference to include. Default: 0 (all games). Set to e.g. 0.5 to filter out tiny differences.",
        },
        order_by: {
          type: "string",
          enum: ["difference_desc", "difference_asc"],
          description: "Sort by difference. Default: difference_desc (biggest gaps first)",
        },
        limit: {
          type: "number",
          description: "Max games to return. Omit for all matching.",
        },
      },
      required: ["compare_against", "direction"],
    },
  },
  {
    name: "get_unranked_games",
    description:
      "Get games in the collection that the user has NOT ranked yet. Use for discovering new games or recommending things they haven't tried.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["party", "board"],
          description: "Filter by category",
        },
        max_players_gte: {
          type: "number",
          description: "Games supporting at least this many players",
        },
        max_time: {
          type: "number",
          description: "Max playing time in minutes",
        },
      },
      required: [],
    },
  },
];
