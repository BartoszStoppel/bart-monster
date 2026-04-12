"use client";

import { useState, useEffect, useRef } from "react";
import { getRank, RANKS, type Rank } from "@/lib/ranks";

interface RankBadgeProps {
  gamesRanked: number;
}

/** Max games threshold for the rank range label. */
function rangeLabel(rank: Rank, index: number): string {
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
 * Click opens a popover listing ranks up to one above the user's current rank.
 */
export function RankBadge({ gamesRanked }: RankBadgeProps) {
  const rank = getRank(gamesRanked);
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

  const currentIndex = RANKS.findIndex((r) => r.name === rank.name);
  const cutoffIndex = Math.max(0, currentIndex - 1);
  const visibleRanks = RANKS.slice(cutoffIndex);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`cursor-pointer text-xs transition-opacity hover:opacity-80 ${rankClasses(rank)}`}
        title={`${gamesRanked} games ranked`}
      >
        {rank.name}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Rank
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Games Ranked
            </span>
          </div>

          {[...visibleRanks].reverse().map((r) => {
            const originalIndex = RANKS.indexOf(r);
            return (
              <RankRow
                key={r.name}
                rank={r}
                range={rangeLabel(r, originalIndex)}
                active={rank.name === r.name}
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
