"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GameExpansion, Tier } from "@/types/database";
import { computeScores } from "@/app/(app)/tier-list/compute-scores";

export interface ExpansionTierEntry {
  tier: Tier;
  expansions: GameExpansion[];
}

/**
 * Persists a user's expansion tier placements for a single game with
 * normalized 1–10 scores. Mirrors the main tier-list save: upsert keyed on
 * (user_id, expansion_id) to avoid the delete-then-insert wipe race, then
 * clean up placements for expansions no longer ranked.
 * @param gameBggId - The game whose expansions are being ranked.
 */
export function useExpansionTierSave(gameBggId: number) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (tiers: ExpansionTierEntry[], allExpansionIds: string[]) => {
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

      const ranked = tiers.flatMap((t) => t.expansions);
      const scores = computeScores(ranked.length);

      const placements = tiers.flatMap(({ tier, expansions }) =>
        expansions.map((exp, position) => {
          const globalIndex = ranked.findIndex((e) => e.id === exp.id);
          return {
            user_id: user.id,
            expansion_id: exp.id,
            game_bgg_id: gameBggId,
            tier,
            position,
            score: scores[globalIndex],
          };
        })
      );

      if (placements.length > 0) {
        const { error: upsertError } = await supabase
          .from("expansion_tier_placements")
          .upsert(placements, { onConflict: "user_id,expansion_id" });

        if (upsertError) {
          setError("Failed to save expansion rankings");
          setSaving(false);
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        const rankedIds = new Set(placements.map((p) => p.expansion_id));
        const unranked = allExpansionIds.filter((id) => !rankedIds.has(id));

        if (unranked.length > 0) {
          const { error: deleteError } = await supabase
            .from("expansion_tier_placements")
            .delete()
            .eq("user_id", user.id)
            .in("expansion_id", unranked);

          if (deleteError) {
            setError("Failed to clean up old placements");
            setSaving(false);
            throw new Error(`Cleanup failed: ${deleteError.message}`);
          }
        }
      } else if (allExpansionIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("expansion_tier_placements")
          .delete()
          .eq("user_id", user.id)
          .in("expansion_id", allExpansionIds);

        if (deleteError) {
          setError("Failed to clear expansion rankings");
          setSaving(false);
          throw new Error(`Delete failed: ${deleteError.message}`);
        }
      }

      setSaving(false);
    },
    [gameBggId]
  );

  return { save, saving, error };
}
