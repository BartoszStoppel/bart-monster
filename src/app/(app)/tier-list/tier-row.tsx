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
      className={`flex min-h-[4.5rem] items-stretch border-b border-outline-variant ${
        isOver ? "bg-surface-container-highest" : ""
      } ${selectedBggId !== null ? "bg-surface-container-high" : ""}`}
    >
      <div
        className={`flex w-12 shrink-0 cursor-pointer items-center justify-center font-stat text-lg font-bold text-white shadow-[inset_-1px_0_0_rgba(0,0,0,0.3),inset_1px_0_0_rgba(255,255,255,0.1)] ${TIER_COLORS[tier]}`}
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
