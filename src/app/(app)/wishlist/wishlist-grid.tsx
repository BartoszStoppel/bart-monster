"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { WishlistCard } from "./wishlist-card";
import { SuggestForMe } from "./suggest-for-me";
import type { WishlistItem, WishlistSortOption, CategoryFilter, SuggestedGame } from "./wishlist-types";

const SORT_OPTIONS: { value: WishlistSortOption; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "bgg-rating", label: "BGG Rating" },
  { value: "weight", label: "Weight" },
  { value: "priority", label: "Priority" },
  { value: "players", label: "Players" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "board", label: "Board" },
  { value: "party", label: "Party" },
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

interface WishlistGridProps {
  items: WishlistItem[];
  suggestions: SuggestedGame[];
  readOnly?: boolean;
}

export function WishlistGrid({ items: initialItems, suggestions, readOnly }: WishlistGridProps) {
  const [items, setItems] = useState(initialItems);
  const [sort, setSort] = useState<WishlistSortOption>("priority");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const {
    containerRef: catContainerRef,
    setRef: setCatRef,
    pill: catPill,
  } = usePillIndicator(category);

  const {
    containerRef: sortContainerRef,
    setRef: setSortRef,
    pill: sortPill,
  } = usePillIndicator(sort);

  function handleRemove(bggId: number) {
    setItems((prev) => prev.filter((i) => i.game.bgg_id !== bggId));
  }

  function handleMoveToOwned(bggId: number) {
    setItems((prev) => prev.filter((i) => i.game.bgg_id !== bggId));
  }

  const sorted = useMemo(() => {
    const filtered = category === "all"
      ? items
      : items.filter((i) => i.game.category === category);

    const copy = [...filtered];
    switch (sort) {
      case "name":
        copy.sort((a, b) => a.game.name.localeCompare(b.game.name));
        break;
      case "bgg-rating":
        copy.sort((a, b) => {
          const ra = a.game.bgg_rating ?? 0;
          const rb = b.game.bgg_rating ?? 0;
          return rb - ra || a.game.name.localeCompare(b.game.name);
        });
        break;
      case "weight":
        copy.sort((a, b) => {
          const wa = a.game.bgg_weight ?? 0;
          const wb = b.game.bgg_weight ?? 0;
          return wb - wa || a.game.name.localeCompare(b.game.name);
        });
        break;
      case "priority":
        copy.sort((a, b) => {
          const pa = a.priority ?? 99;
          const pb = b.priority ?? 99;
          return pa - pb || a.game.name.localeCompare(b.game.name);
        });
        break;
      case "players":
        copy.sort((a, b) => {
          const ma = a.game.max_players ?? 0;
          const mb = b.game.max_players ?? 0;
          return mb - ma || a.game.name.localeCompare(b.game.name);
        });
        break;
    }
    return copy;
  }, [items, sort, category]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          ref={catContainerRef}
          className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
        >
          <div
            className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10 dark:shadow-cyan-500/5"
            style={{ left: catPill.left, width: catPill.width }}
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
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Sort</span>
          <div
            ref={sortContainerRef}
            className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
          >
            <div
              className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10 dark:shadow-cyan-500/5"
              style={{ left: sortPill.left, width: sortPill.width }}
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
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {sorted.length} game{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-white/[0.06] dark:bg-white/5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No games on your wishlist yet. Search for games and add them!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <WishlistCard
              key={item.game.bgg_id}
              item={item}
              readOnly={readOnly}
              onRemove={handleRemove}
              onMoveToOwned={handleMoveToOwned}
            />
          ))}
        </div>
      )}

      {/* Suggestions — only for own wishlist */}
      {!readOnly && suggestions.length > 0 && (
        <SuggestForMe suggestions={suggestions} />
      )}
    </div>
  );
}
