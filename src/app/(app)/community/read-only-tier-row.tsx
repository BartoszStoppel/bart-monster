import type { BoardGame } from "@/types/database";
import { TIER_COLORS } from "@/lib/tier-colors";
import { ReadOnlyGameTile } from "./read-only-game-tile";

export interface TierGameEntry {
  game: BoardGame;
  shadow: boolean;
}

interface ReadOnlyTierRowProps {
  tier: string;
  entries: TierGameEntry[];
  hotTakeId?: number | null;
}

export function ReadOnlyTierRow({ tier, entries, hotTakeId }: ReadOnlyTierRowProps) {
  if (entries.length === 0) return null;

  return (
    <div className="flex min-h-[4.5rem] items-stretch border-b border-zinc-200 last:border-b-0 dark:border-zinc-700">
      <div
        className={`flex w-12 shrink-0 items-center justify-center text-lg font-bold text-white ${TIER_COLORS[tier]}`}
      >
        {tier}
      </div>
      <div className="flex min-h-[4.5rem] flex-1 flex-wrap items-center gap-1 p-1">
        {entries.map((entry) => (
          <ReadOnlyGameTile
            key={entry.shadow ? `shadow-${entry.game.bgg_id}` : entry.game.bgg_id}
            game={entry.game}
            shadow={entry.shadow}
            hotTake={hotTakeId === entry.game.bgg_id}
          />
        ))}
      </div>
    </div>
  );
}
