"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getRank, getAdjective, RANKS, ADJECTIVES, type Rank, type Adjective } from "@/lib/ranks";

interface TitleDisplayProps {
  gamesRanked: number;
  gamesOwned: number;
}

function rankRangeLabel(rank: Rank, index: number): string {
  const next = index > 0 ? RANKS[index - 1] : null;
  const max = next ? next.minGames - 1 : null;
  if (max === null) return `${rank.minGames}+`;
  if (max === rank.minGames) return `${rank.minGames}`;
  return `${rank.minGames}–${max}`;
}

function adjRangeLabel(adj: Adjective, index: number): string {
  const next = index > 0 ? ADJECTIVES[index - 1] : null;
  const max = next ? next.minOwned - 1 : null;
  if (max === null) return `${adj.minOwned}+`;
  if (max === adj.minOwned) return `${adj.minOwned}`;
  return `${adj.minOwned}–${max}`;
}

function rankClasses(rank: Rank): string {
  const weight = rank.bold ? "font-bold" : "font-medium";
  return `rounded-full px-2 py-0.5 ${weight} ${rank.color} ${rank.darkColor}`;
}

/** Extract only the text-* classes from a color string (drop bg-* classes). */
function textOnly(color: string, darkColor: string): string {
  const lightText = color.split(" ").filter((c) => c.startsWith("text-")).join(" ");
  const darkText = darkColor.split(" ").filter((c) => c.includes("text-")).join(" ");
  return `${lightText} ${darkText}`;
}

function Popover({
  open,
  onOpen,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  return (
    <span
      className="relative inline"
      ref={ref}
      onPointerEnter={(e) => { if (e.pointerType !== "touch") onOpen(); }}
      onPointerLeave={(e) => { if (e.pointerType !== "touch") onClose(); }}
      onClick={onOpen}
    >
      <span className={`cursor-default transition-opacity hover:opacity-70 ${className ?? ""}`}>
        {label}
      </span>
      {open && children}
    </span>
  );
}

/**
 * Inline title display: "the Hoarding Dragonslayer"
 * Hover/tap the adjective for the holdings popover.
 * Hover/tap the rank for the renown popover.
 */
export function TitleDisplay({ gamesRanked, gamesOwned }: TitleDisplayProps) {
  const rank = getRank(gamesRanked);
  const adj = getAdjective(gamesOwned);
  const [adjOpen, setAdjOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);

  const openAdj = useCallback(() => { setAdjOpen(true); setRankOpen(false); }, []);
  const closeAdj = useCallback(() => setAdjOpen(false), []);
  const openRank = useCallback(() => { setRankOpen(true); setAdjOpen(false); }, []);
  const closeRank = useCallback(() => setRankOpen(false), []);

  const currentRankIndex = RANKS.findIndex((r) => r.name === rank.name);
  const rankCutoff = Math.max(0, currentRankIndex - 1);
  const visibleRanks = RANKS.slice(rankCutoff);

  const currentAdjIndex = ADJECTIVES.findIndex((a) => a.name === adj.name);
  const adjCutoff = Math.max(0, currentAdjIndex - 1);
  const visibleAdjs = ADJECTIVES.slice(adjCutoff);

  return (
    <span className="font-normal">
      <span className="text-zinc-900 dark:text-zinc-50">the</span>{" "}
      <Popover open={adjOpen} onOpen={openAdj} onClose={closeAdj} label={adj.name} className={textOnly(adj.color, adj.darkColor)}>
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Holdings
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Games Owned
            </span>
          </div>
          {[...visibleAdjs].reverse().map((a) => {
            const idx = ADJECTIVES.indexOf(a);
            return (
              <div
                key={a.name}
                className={`flex items-center justify-between rounded px-2 py-1 ${
                  adj.name === a.name ? "bg-zinc-100 dark:bg-zinc-700" : ""
                }`}
              >
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a.color} ${a.darkColor}`}>
                  {a.name}
                </span>
                <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {adjRangeLabel(a, idx)}
                </span>
              </div>
            );
          })}
        </div>
      </Popover>{" "}
      <Popover open={rankOpen} onOpen={openRank} onClose={closeRank} label={rank.name} className={textOnly(rank.color, rank.darkColor)}>
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Renown
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Games Played
            </span>
          </div>
          {[...visibleRanks].reverse().map((r) => {
            const idx = RANKS.indexOf(r);
            return (
              <div
                key={r.name}
                className={`flex items-center justify-between rounded px-2 py-1 ${
                  rank.name === r.name ? "bg-zinc-100 dark:bg-zinc-700" : ""
                }`}
              >
                <span className={`text-[11px] ${rankClasses(r)}`}>
                  {r.name}
                </span>
                <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                  {rankRangeLabel(r, idx)}
                </span>
              </div>
            );
          })}
        </div>
      </Popover>
    </span>
  );
}
