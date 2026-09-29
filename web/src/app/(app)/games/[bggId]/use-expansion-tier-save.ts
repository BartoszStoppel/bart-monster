import type { GameExpansion, Tier } from "@/types/database";
import { useRankingSave } from "@/lib/use-ranking-save";
export interface ExpansionTierEntry {
  tier: Tier;
  expansions: GameExpansion[];
}
export function useExpansionTierSave(gameBggId: number, revision: string) {
  const state = useRankingSave(
    `/api/expansion-rankings/${gameBggId}`,
    revision,
  );
  return {
    ...state,
    save: (tiers: ExpansionTierEntry[], _ids?: string[]) =>
      state.save(
        tiers.flatMap((t) =>
          t.expansions.map((e) => ({ id: e.id, tier: t.tier })),
        ),
      ),
  };
}
