"use client";

import { useState, useMemo } from "react";
import { WishlistCard } from "./wishlist-card";
import { SuggestForMe } from "./suggest-for-me";
import type { WishlistItem, WishlistSortOption, CategoryFilter, SuggestedGame } from "./wishlist-types";

const SORT_OPTIONS: { value: WishlistSortOption; label: string; icon: string }[] = [
  { value: "priority", label: "Priority", icon: "flag" },
  { value: "name", label: "Name", icon: "sort_by_alpha" },
  { value: "bgg-rating", label: "BGG Rating", icon: "public" },
  { value: "weight", label: "Weight", icon: "fitness_center" },
  { value: "players", label: "Players", icon: "group" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string; icon: string }[] = [
  { value: "all", label: "All Species", icon: "apps" },
  { value: "board", label: "Board", icon: "castle" },
  { value: "party", label: "Party", icon: "celebration" },
];

interface WishlistGridProps {
  items: WishlistItem[];
  suggestions: SuggestedGame[];
  readOnly?: boolean;
}

export function WishlistGrid({ items: initialItems, suggestions, readOnly }: WishlistGridProps) {
  const [items, setItems] = useState(initialItems);
  const [sort, setSort] = useState<WishlistSortOption>("priority");
  const [category, setCategory] = useState<CategoryFilter>("all");

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
    <div className="flex flex-col gap-stack-loose">
      {/* Rune-chip filter + sort row */}
      <div className="flex flex-wrap items-center gap-3">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setCategory(opt.value)}
            className={`rune-chip flex items-center gap-2 rounded-full px-4 py-1.5 font-stat text-stat-label ${
              category === opt.value ? "active" : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
            {opt.label}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="font-stat text-stat-label text-on-surface-variant">
            {sorted.length} game{sorted.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">sort</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                title={`Sort by ${opt.label}`}
                className={`rune-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 font-stat text-stat-label ${
                  sort === opt.value ? "active" : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                <span className="hidden lg:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
          <span className="material-symbols-outlined text-[40px] text-outline">redeem</span>
          <p className="text-on-surface-variant">
            No treasures on your wishlist yet. Seek out games and covet them!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-gutter">
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
