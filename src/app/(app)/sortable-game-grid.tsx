"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { GameCard } from "@/components/game-card";
import type { BoardGame } from "@/types/database";

type SortOption = "ours" | "bgg" | "name" | "weight";
type CategoryFilter = "all" | "board" | "party";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "ours", label: "Our Rating" },
  { value: "bgg", label: "BGG Rating" },
  { value: "name", label: "Name" },
  { value: "weight", label: "Weight" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "board", label: "Board Games" },
  { value: "party", label: "Party Games" },
];

function usePillIndicator<T extends string>(active: T) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const btn = btnRefs.current.get(active);
    if (container && btn) {
      const cr = container.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setPill({ left: br.left - cr.left, width: br.width });
    }
  }, [active]);

  useEffect(() => {
    measure();
  }, [measure]);

  const setRef = useCallback((key: T, el: HTMLButtonElement | null) => {
    if (el) btnRefs.current.set(key, el);
  }, []);

  return { containerRef, setRef, pill };
}

interface SortableGameGridProps {
  games: BoardGame[];
  avgScoreMap: Record<string, number>;
  ownedSet: number[];
}

export function SortableGameGrid({
  games,
  avgScoreMap,
  ownedSet,
}: SortableGameGridProps) {
  const [sort, setSort] = useState<SortOption>("ours");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const {
    containerRef: catContainerRef,
    setRef: setCatRef,
    pill: catPillStyle,
  } = usePillIndicator(category);
  const {
    containerRef: sortContainerRef,
    setRef: setSortRef,
    pill: sortPillStyle,
  } = usePillIndicator(sort);

  const owned = useMemo(() => new Set(ownedSet), [ownedSet]);
  const scores = useMemo(
    () => new Map(Object.entries(avgScoreMap).map(([k, v]) => [Number(k), v])),
    [avgScoreMap]
  );

  const sorted = useMemo(() => {
    const filtered = category === "all"
      ? games
      : games.filter((g) => g.category === category);
    const copy = [...filtered];
    switch (sort) {
      case "ours":
        copy.sort((a, b) => {
          const sa = scores.get(a.bgg_id);
          const sb = scores.get(b.bgg_id);
          if (sa == null && sb == null) return a.name.localeCompare(b.name);
          if (sa == null) return 1;
          if (sb == null) return -1;
          return sb - sa;
        });
        break;
      case "bgg":
        copy.sort((a, b) => {
          const ra = a.bgg_rating ?? 0;
          const rb = b.bgg_rating ?? 0;
          return rb - ra || a.name.localeCompare(b.name);
        });
        break;
      case "name":
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "weight":
        copy.sort((a, b) => {
          const wa = a.bgg_weight ?? 0;
          const wb = b.bgg_weight ?? 0;
          return wb - wa || a.name.localeCompare(b.name);
        });
        break;
    }
    return copy;
  }, [games, sort, scores, category]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          ref={catContainerRef}
          className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
        >
          <div
            className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-zinc-700"
            style={{ left: catPillStyle.left, width: catPillStyle.width }}
          />
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              ref={(el) => setCatRef(opt.value, el)}
              onClick={() => setCategory(opt.value)}
              className={`relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                category === opt.value
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Sort by</span>
          <div
            ref={sortContainerRef}
            className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
          >
            <div
              className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-zinc-700"
              style={{ left: sortPillStyle.left, width: sortPillStyle.width }}
            />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                ref={(el) => setSortRef(opt.value, el)}
                onClick={() => setSort(opt.value)}
                className={`relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  sort === opt.value
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {sorted.map((game) => (
          <GameCard
            key={game.bgg_id}
            game={game}
            avgScore={scores.get(game.bgg_id)}
            owned={owned.has(game.bgg_id)}
          />
        ))}
      </div>
    </div>
  );
}
