"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { BoardGame, Tier } from "@/types/database";
import { TIER_COLORS } from "@/lib/tier-colors";
import { GameTile } from "./game-tile";

interface TierRowProps {
  tier: string;
  games: BoardGame[];
  selectedBggId: number | null;
  onTileTap: (bggId: number) => void;
  onTierTap: (tier: Tier | "unplayed") => void;
}

export function TierRow({ tier, games, selectedBggId, onTileTap, onTierTap }: TierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier}` });
  const gameIds = games.map((g) => g.bgg_id);

  return (
    <div
      className={`flex min-h-[4.5rem] items-stretch border-b border-zinc-200 dark:border-white/10 ${
        isOver ? "bg-zinc-100 dark:bg-white/10" : ""
      } ${selectedBggId !== null ? "bg-zinc-50 dark:bg-white/5" : ""}`}
    >
      <div
        className={`flex w-12 shrink-0 cursor-pointer items-center justify-center text-lg font-bold text-white ${TIER_COLORS[tier]}`}
        onClick={() => onTierTap(tier as Tier)}
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
          onClick={(e) => {
            if (e.target === e.currentTarget) onTierTap(tier as Tier);
          }}
        >
          {games.map((game) => (
            <GameTile
              key={game.bgg_id}
              game={game}
              isSelected={selectedBggId === game.bgg_id}
              onTileTap={onTileTap}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
