"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { computeScores } from "@/app/(app)/tier-list/compute-scores";
import type { Tier } from "@/types/database";

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D", "F"];

/**
 * Deletes a game and all related data. Admin-only.
 * Foreign keys have ON DELETE CASCADE, so deleting from board_games
 * removes tier_placements and user_game_collection rows automatically.
 * After deletion, recalculates scores for all affected users.
 */
export async function deleteGame(bggId: number) {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) {
    throw new Error("Unauthorized");
  }

  const { data: affectedPlacements } = await supabase
    .from("tier_placements")
    .select("user_id")
    .eq("bgg_id", bggId);

  const affectedUserIds = [
    ...new Set((affectedPlacements ?? []).map((p) => p.user_id)),
  ];

  const { error } = await supabase
    .from("board_games")
    .delete()
    .eq("bgg_id", bggId);

  if (error) {
    throw new Error(error.message);
  }

  await recalculateScores(supabase, affectedUserIds);

  redirect("/");
}

async function recalculateScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
) {
  for (const userId of userIds) {
    const { data: placements } = await supabase
      .from("tier_placements")
      .select("id, tier, position")
      .eq("user_id", userId);

    if (!placements || placements.length === 0) continue;

    const sorted = placements.sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(a.tier as Tier) - TIER_ORDER.indexOf(b.tier as Tier);
      if (tierDiff !== 0) return tierDiff;
      return a.position - b.position;
    });

    const scores = computeScores(sorted.length);

    const updates = sorted.map((p, i) => ({
      id: p.id,
      score: scores[i],
    }));

    for (const update of updates) {
      await supabase
        .from("tier_placements")
        .update({ score: update.score })
        .eq("id", update.id);
    }
  }
}
