"use client";

import { useState, useEffect, useRef } from "react";
import { getRank, RANKS, ARCHMAGE_RANK, type Rank } from "@/lib/ranks";

interface RankBadgeProps {
  gamesRanked: number;
  isAdmin: boolean;
}

/** Max games threshold for the rank range label. */
function rangeLabel(rank: Rank, index: number): string {
  if (rank === ARCHMAGE_RANK) return "Admin";
  const next = index > 0 ? RANKS[index - 1] : null;
  const max = next ? next.minGames - 1 : null;
  return max !== null ? `${rank.minGames}–${max}` : `${rank.minGames}+`;
}

function rankClasses(rank: Rank): string {
  const weight = rank.bold ? "font-bold" : "font-medium";
  return `rounded-full px-2 py-0.5 ${weight} ${rank.color} ${rank.darkColor}`;
}

/**
 * Pill badge showing a user's RPG rank. Hover shows game count.
 * Click opens a popover listing all ranks with thresholds.
 */
export function RankBadge({ gamesRanked, isAdmin }: RankBadgeProps) {
  const rank = getRank(gamesRanked, isAdmin);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`cursor-pointer text-xs transition-opacity hover:opacity-80 ${rankClasses(rank)}`}
        title={isAdmin ? "Admin" : `${gamesRanked} games ranked`}
      >
        {rank.name}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Rank Ladder
          </p>

          {/* Archmage */}
          <RankRow
            rank={ARCHMAGE_RANK}
            range="Admin"
            active={isAdmin}
          />

          <div className="my-1.5 border-t border-zinc-100 dark:border-zinc-700" />

          {/* All progression ranks (reversed so lowest is at bottom) */}
          {[...RANKS].reverse().map((r, i) => {
            const originalIndex = RANKS.length - 1 - i;
            return (
              <RankRow
                key={r.name}
                rank={r}
                range={rangeLabel(r, originalIndex)}
                active={!isAdmin && rank.name === r.name}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankRow({ rank, range, active }: { rank: Rank; range: string; active: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1 ${
        active ? "bg-zinc-100 dark:bg-zinc-700" : ""
      }`}
    >
      <span className={`text-[11px] ${rankClasses(rank)}`}>
        {rank.name}
      </span>
      <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {range}
      </span>
    </div>
  );
}
