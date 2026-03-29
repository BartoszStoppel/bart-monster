"use server";

import { createClient } from "@/lib/supabase/server";
import type { BoardGame, Tier } from "@/types/database";
import type { UserTierData } from "./community-tier-lists";
import { computeAlignments } from "./compute-alignment";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];
const CATEGORIES = ["board", "party"] as const;

/**
 * Recompute alignment data for all users across both categories
 * and store the results in the user_alignments table.
 * Called after any tier list save or game deletion.
 */
export async function recomputeAlignments(): Promise<void> {
  const supabase = await createClient();

  const [{ data: allGames }, { data: placements }, { data: profiles }] =
    await Promise.all([
      supabase.from("board_games").select("*").order("name"),
      supabase
        .from("tier_placements")
        .select("bgg_id, tier, position, user_id")
        .limit(10000),
      supabase.from("profiles").select("id, display_name, avatar_url"),
    ]);

  if (!allGames || !placements || !profiles) return;

  const profileMap = new Map(
    profiles.map((p) => [
      p.id,
      { display_name: p.display_name, avatar_url: p.avatar_url },
    ])
  );

  const rows: {
    user_id: string;
    category: string;
    display_name: string;
    avatar_url: string | null;
    allies: unknown;
    rivals: unknown;
    updated_at: string;
  }[] = [];

  for (const category of CATEGORIES) {
    const gameMap = new Map<number, BoardGame>();
    for (const g of allGames) {
      if (g.category === category) gameMap.set(g.bgg_id, g);
    }

    const byUser = new Map<
      string,
      { bgg_id: number; tier: Tier; position: number }[]
    >();
    for (const p of placements) {
      if (!gameMap.has(p.bgg_id)) continue;
      let list = byUser.get(p.user_id);
      if (!list) {
        list = [];
        byUser.set(p.user_id, list);
      }
      list.push({
        bgg_id: p.bgg_id,
        tier: p.tier as Tier,
        position: p.position,
      });
    }

    const users: UserTierData[] = [];
    for (const [userId, userPlacements] of byUser) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      const buckets: Record<Tier, BoardGame[]> = {
        S: [],
        A: [],
        B: [],
        C: [],
        D: [],
        F: [],
      };
      for (const tier of TIERS) {
        const tierPlacements = userPlacements
          .filter((p) => p.tier === tier)
          .sort((a, b) => a.position - b.position);
        for (const p of tierPlacements) {
          const game = gameMap.get(p.bgg_id);
          if (game) buckets[tier].push(game);
        }
      }

      const totalRanked = TIERS.reduce(
        (sum, tier) => sum + buckets[tier].length,
        0
      );
      if (totalRanked === 0) continue;

      users.push({
        userId,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        buckets,
        gamesOwned: 0,
      });
    }

    const alignments = computeAlignments(users);

    for (const a of alignments) {
      const profile = profileMap.get(a.userId);
      rows.push({
        user_id: a.userId,
        category,
        display_name: profile?.display_name ?? a.displayName,
        avatar_url: profile?.avatar_url ?? a.avatarUrl,
        allies: a.allies,
        rivals: a.rivals,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Clear old data and insert fresh
  const { error: deleteError } = await supabase
    .from("user_alignments")
    .delete()
    .neq("user_id", "");

  if (deleteError) {
    console.error("[recompute-alignments] delete failed:", deleteError);
    throw new Error(`Delete failed: ${deleteError.message}`);
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("user_alignments")
      .upsert(rows, { onConflict: "user_id,category" });

    if (upsertError) {
      console.error("[recompute-alignments] upsert failed:", upsertError);
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }
  }
}
