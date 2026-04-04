"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { recomputeAlignments } from "./community/recompute-alignments";
import type { Tier } from "@/types/database";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

interface UpdateGamePayload {
  bggId: number;
  category: "party" | "board";
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
}

/**
 * Recompute tier_placements.score for all users in a given category.
 * Scores are 10→1 spread evenly across all games a user ranked in that category.
 */
async function recomputeScoresForCategory(category: "party" | "board") {
  const supabase = await createClient();

  const { data: categoryGames } = await supabase
    .from("board_games")
    .select("bgg_id")
    .eq("category", category);

  if (!categoryGames) return;
  const categoryBggIds = new Set(categoryGames.map((g) => g.bgg_id));

  const { data: placements } = await supabase
    .from("tier_placements")
    .select("id, user_id, bgg_id, tier, position")
    .limit(10000);

  if (!placements) return;

  // Filter to only placements for games in this category
  const categoryPlacements = placements.filter((p) => categoryBggIds.has(p.bgg_id));

  // Group by user
  const byUser = new Map<string, typeof categoryPlacements>();
  for (const p of categoryPlacements) {
    let list = byUser.get(p.user_id);
    if (!list) {
      list = [];
      byUser.set(p.user_id, list);
    }
    list.push(p);
  }

  // Recompute scores for each user
  const updates: { id: string; score: number }[] = [];

  for (const [, userPlacements] of byUser) {
    // Build flat ranking: S left-to-right, then A, ..., F
    const ranked: typeof userPlacements = [];
    for (const tier of TIERS) {
      const tierPlacements = userPlacements
        .filter((p) => p.tier === tier)
        .sort((a, b) => a.position - b.position);
      ranked.push(...tierPlacements);
    }

    const count = ranked.length;
    if (count === 0) continue;

    for (let i = 0; i < count; i++) {
      const score = count === 1
        ? 10
        : Math.round((10 - i * (9 / (count - 1))) * 10) / 10;
      updates.push({ id: ranked[i].id, score });
    }
  }

  // Batch update scores
  for (const { id, score } of updates) {
    await supabase
      .from("tier_placements")
      .update({ score })
      .eq("id", id);
  }
}

/**
 * Updates editable metadata for a board game. Admin-only.
 * When category changes, recomputes scores for all users in both categories.
 * @param payload - The fields to update
 */
export async function updateGame(payload: UpdateGamePayload) {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) {
    throw new Error("Unauthorized");
  }

  // Check if category is changing
  const { data: currentGame } = await supabase
    .from("board_games")
    .select("category")
    .eq("bgg_id", payload.bggId)
    .single();

  const categoryChanged = currentGame?.category !== payload.category;

  const { error } = await supabase
    .from("board_games")
    .update({
      category: payload.category,
      min_players: payload.minPlayers,
      max_players: payload.maxPlayers,
      playing_time: payload.playingTime,
    })
    .eq("bgg_id", payload.bggId);

  if (error) {
    throw new Error(error.message);
  }

  if (categoryChanged) {
    // Recompute scores in both categories (old and new) since game counts shifted
    await Promise.all([
      recomputeScoresForCategory("board"),
      recomputeScoresForCategory("party"),
    ]);

    // Recompute alignments since scores changed
    await recomputeAlignments();

    // Log community average snapshots for affected games
    const { data: allPlacements } = await supabase
      .from("tier_placements")
      .select("bgg_id, score")
      .not("score", "is", null)
      .limit(10000);

    if (allPlacements) {
      const avgMap = new Map<number, { total: number; count: number }>();
      for (const p of allPlacements) {
        const entry = avgMap.get(p.bgg_id) ?? { total: 0, count: 0 };
        entry.total += Number(p.score);
        entry.count += 1;
        avgMap.set(p.bgg_id, entry);
      }
      const avgSnapshots = [...avgMap.entries()].map(([bggId, { total, count }]) => ({
        user_id: null,
        bgg_id: bggId,
        score: Math.round((total / count) * 10) / 10,
      }));
      await supabase.from("score_snapshots").insert(avgSnapshots);
    }
  }

  revalidatePath("/");
}
