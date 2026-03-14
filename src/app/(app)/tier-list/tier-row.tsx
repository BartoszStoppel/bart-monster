"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { BoardGame } from "@/types/database";
import { TIER_COLORS } from "@/lib/tier-colors";
import { GameTile } from "./game-tile";

interface TierRowProps {
  tier: string;
  games: BoardGame[];
}

export function TierRow({ tier, games }: TierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier}` });
  const gameIds = games.map((g) => g.bgg_id);

  return (
    <div
      className={`flex min-h-[4.5rem] items-stretch border-b border-zinc-200 dark:border-zinc-700 ${
        isOver ? "bg-zinc-100 dark:bg-zinc-800/50" : ""
      }`}
    >
      <div
        className={`flex w-12 shrink-0 items-center justify-center text-lg font-bold text-white ${TIER_COLORS[tier]}`}
      >
        {tier}
      </div>
      <SortableContext
        id={`tier-${tier}`}
        items={gameIds}
        strategy={horizontalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex min-h-[4.5rem] flex-1 flex-wrap items-center gap-1 p-1"
        >
          {games.map((game) => (
            <GameTile key={game.bgg_id} game={game} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
