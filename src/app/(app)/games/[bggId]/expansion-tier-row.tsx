"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { GameExpansion, Tier } from "@/types/database";
import { TIER_COLORS } from "@/lib/tier-colors";
import { ExpansionTile } from "./expansion-tile";

interface ExpansionTierRowProps {
  tier: string;
  expansions: GameExpansion[];
  selectedId: string | null;
  onTileTap: (id: string) => void;
  onTierTap: (tier: Tier | "unranked") => void;
}

export function ExpansionTierRow({
  tier,
  expansions,
  selectedId,
  onTileTap,
  onTierTap,
}: ExpansionTierRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `etier-${tier}` });
  const ids = expansions.map((e) => e.id);

  return (
    <div
      className={`flex min-h-[4.5rem] items-stretch border-b border-outline-variant ${
        isOver ? "bg-surface-container-highest" : ""
      } ${selectedId !== null ? "bg-surface-container-high" : ""}`}
    >
      <div
        className={`flex w-10 shrink-0 cursor-pointer items-center justify-center text-base font-bold text-white ${TIER_COLORS[tier]}`}
        onClick={() => onTierTap(tier as Tier)}
      >
        {tier}
      </div>
      <SortableContext
        id={`etier-${tier}`}
        items={ids}
        strategy={horizontalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex min-h-[4.5rem] flex-1 flex-wrap items-center gap-1.5 p-1.5"
          onClick={(e) => {
            if (e.target === e.currentTarget) onTierTap(tier as Tier);
          }}
        >
          {expansions.map((exp) => (
            <ExpansionTile
              key={exp.id}
              expansion={exp}
              isSelected={selectedId === exp.id}
              onTileTap={onTileTap}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
