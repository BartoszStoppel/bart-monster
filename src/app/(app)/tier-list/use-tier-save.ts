"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BoardGame, Tier } from "@/types/database";
import { flatRanking, computeScores } from "./compute-scores";
import { recomputeAlignments } from "../community/recompute-alignments";

export interface TierEntry {
  tier: Tier;
  games: BoardGame[];
}

/**
 * Hook that persists tier placements with normalized 1–10 scores.
 * Uses upsert to avoid the delete-then-insert race where a failed
 * insert would silently wipe all data.
 */
export function useTierSave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (tiers: TierEntry[], categoryGameIds: number[]) => {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setError("Not authenticated");
      return;
    }

    const ranked = flatRanking(tiers);
    const scores = computeScores(ranked.length);

    const placements = tiers.flatMap(({ tier, games }) =>
      games.map((game, position) => {
        const globalIndex = ranked.findIndex(
          (g) => g.bgg_id === game.bgg_id
        );
        return {
          user_id: user.id,
          bgg_id: game.bgg_id,
          tier,
          position,
          score: scores[globalIndex],
        };
      })
    );

    if (placements.length > 0) {
      const { error: upsertError } = await supabase
        .from("tier_placements")
        .upsert(placements, { onConflict: "user_id,bgg_id" });

      if (upsertError) {
        setError("Failed to save tier placements");
        setSaving(false);
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }

      // Log score snapshots for the history chart (user + community avg)
      const userSnapshots = placements.map((p) => ({
        user_id: p.user_id,
        bgg_id: p.bgg_id,
        score: p.score,
      }));
      await supabase.from("score_snapshots").insert(userSnapshots);

      // Compute and log community average snapshots
      const rankedBggIdsForAvg = placements.map((p) => p.bgg_id);
      const { data: allPlacementsForAvg } = await supabase
        .from("tier_placements")
        .select("bgg_id, score")
        .in("bgg_id", rankedBggIdsForAvg)
        .not("score", "is", null);

      if (allPlacementsForAvg) {
        const avgMap = new Map<number, { total: number; count: number }>();
        for (const p of allPlacementsForAvg) {
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

      const rankedBggIds = new Set(placements.map((p) => p.bgg_id));
      const unrankedCategoryIds = categoryGameIds.filter(
        (id) => !rankedBggIds.has(id)
      );

      if (unrankedCategoryIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("tier_placements")
          .delete()
          .eq("user_id", user.id)
          .in("bgg_id", unrankedCategoryIds);

        if (deleteError) {
          setError("Failed to clean up old placements");
          setSaving(false);
          throw new Error(`Cleanup failed: ${deleteError.message}`);
        }
      }
    } else {
      const { error: deleteError } = await supabase
        .from("tier_placements")
        .delete()
        .eq("user_id", user.id)
        .in("bgg_id", categoryGameIds);

      if (deleteError) {
        setError("Failed to clear tier placements");
        setSaving(false);
        throw new Error(`Delete failed: ${deleteError.message}`);
      }
    }

    // Recompute alignment table in the background
    recomputeAlignments().catch((err) => {
      console.error("[tier-save] alignment recompute failed:", err);
    });

    setSaving(false);
  }, []);

  return { save, saving, error };
}
