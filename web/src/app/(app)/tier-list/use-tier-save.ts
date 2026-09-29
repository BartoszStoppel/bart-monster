import type { BoardGame, Tier } from "@/types/database";
import { useRankingSave } from "@/lib/use-ranking-save";
import { tierNumber } from "@/lib/metrics";
export function useTierSave(
  category: "board" | "party",
  metric: "enjoyment" | "difficulty",
  revision: string,
) {
  const state = useRankingSave(`/api/rankings/${metric}/${category}`, revision);
  return {
    ...state,
    save: (tiers: Array<{ tier: Tier; games: BoardGame[] }>, _ids?: number[]) =>
      state.save(
        tiers.flatMap((t) =>
          t.games.map((g) => ({
            id: g.bgg_id,
            tier: metric === "difficulty" ? String(tierNumber(t.tier)) : t.tier,
          })),
        ),
      ),
  };
}

export interface TierEntry {
  tier: Tier;
  games: BoardGame[];
}
