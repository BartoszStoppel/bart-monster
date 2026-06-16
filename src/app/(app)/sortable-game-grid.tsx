"use client";

import { useState, useMemo, useCallback } from "react";
import { GameCard } from "@/components/game-card";
import { BggMark } from "@/components/bgg-mark";
import { createClient } from "@/lib/supabase/client";
import { getMonsterLevel } from "@/lib/monster-level";
import type { BoardGame } from "@/types/database";

type SortOption = "ours" | "level" | "bgg" | "name" | "weight" | "decorated";
type Category = "board" | "party";

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: "ours", label: "Our Rating", icon: "trophy" },
  { value: "level", label: "Level", icon: "stairs" },
  { value: "bgg", label: "BGG", icon: "public" },
  { value: "name", label: "Name", icon: "sort_by_alpha" },
  { value: "weight", label: "Weight", icon: "fitness_center" },
  { value: "decorated", label: "Decorated", icon: "military_tech" },
];

const CATEGORY_OPTIONS: { value: Category; label: string; icon: string }[] = [
  { value: "board", label: "Board", icon: "castle" },
  { value: "party", label: "Party", icon: "celebration" },
];

export interface CategoryBadges {
  gold: string[];
  silver: string[];
  bronze: string[];
  trash: string[];
}

export interface GameBadges {
  board?: CategoryBadges;
  party?: CategoryBadges;
}

interface SortableGameGridProps {
  games: BoardGame[];
  avgScoreMap: Record<string, number>;
  ownedSet: number[];
  wishlistSet?: number[];
  isAdmin?: boolean;
  badgeMap?: Record<number, GameBadges>;
}

export function SortableGameGrid({
  games: initialGames,
  avgScoreMap,
  ownedSet,
  wishlistSet: wishlistSetProp = [],
  isAdmin: admin,
  badgeMap = {},
}: SortableGameGridProps) {
  const [games, setGames] = useState(initialGames);
  const [sort, setSort] = useState<SortOption>("ours");
  const [categories, setCategories] = useState<Set<Category>>(() => new Set<Category>(["board", "party"]));
  const [ownedOnly, setOwnedOnly] = useState(false);

  function toggleCategory(value: Category) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }
  const [ownedIds, setOwnedIds] = useState(() => new Set(ownedSet));
  const [wishlistIds, setWishlistIds] = useState(() => new Set(wishlistSetProp));

  function handleGameUpdated(bggId: number, updates: Partial<BoardGame>) {
    setGames((prev) =>
      prev.map((g) => (g.bgg_id === bggId ? { ...g, ...updates } : g))
    );
  }

  async function handleOwnershipToggle(bggId: number) {
    const adding = !ownedIds.has(bggId);
    setOwnedIds((prev) => {
      const next = new Set(prev);
      if (adding) next.add(bggId);
      else next.delete(bggId);
      return next;
    });
    if (adding) {
      setWishlistIds((prev) => { const next = new Set(prev); next.delete(bggId); return next; });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (adding) {
      const { error } = await supabase.from("user_game_collection").upsert(
        { user_id: user.id, bgg_id: bggId, owned: true, wishlist: false },
        { onConflict: "user_id,bgg_id" }
      );
      if (error) {
        setOwnedIds((prev) => { const next = new Set(prev); next.delete(bggId); return next; });
      }
    } else {
      const { error } = await supabase
        .from("user_game_collection")
        .update({ owned: false })
        .eq("user_id", user.id)
        .eq("bgg_id", bggId);
      if (error) {
        setOwnedIds((prev) => { const next = new Set(prev); next.add(bggId); return next; });
      }
    }
  }

  async function handleWishlistToggle(bggId: number) {
    const adding = !wishlistIds.has(bggId);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (adding) next.add(bggId);
      else next.delete(bggId);
      return next;
    });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (adding) {
      const { error } = await supabase.from("user_game_collection").upsert(
        { user_id: user.id, bgg_id: bggId, wishlist: true, owned: false },
        { onConflict: "user_id,bgg_id" }
      );
      if (error) {
        setWishlistIds((prev) => { const next = new Set(prev); next.delete(bggId); return next; });
      }
    } else {
      const { error } = await supabase
        .from("user_game_collection")
        .update({ wishlist: false })
        .eq("user_id", user.id)
        .eq("bgg_id", bggId);
      if (error) {
        setWishlistIds((prev) => { const next = new Set(prev); next.add(bggId); return next; });
      }
    }
  }

  const scores = useMemo(
    () => new Map(Object.entries(avgScoreMap).map(([k, v]) => [Number(k), v])),
    [avgScoreMap]
  );

  const decorationScore = useCallback(
    (bggId: number): number => {
      const badges = badgeMap[bggId];
      if (!badges) return 0;
      let score = 0;
      for (const cat of [badges.board, badges.party]) {
        if (!cat) continue;
        score += cat.gold.length * 4;
        score += cat.silver.length * 2;
        score += cat.bronze.length * 1;
      }
      return score;
    },
    [badgeMap]
  );

  const sorted = useMemo(() => {
    let filtered = games.filter((g) => categories.has(g.category as Category));
    if (ownedOnly) {
      filtered = filtered.filter((g) => ownedIds.has(g.bgg_id));
    }
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
      case "level":
        copy.sort((a, b) => {
          const la = getMonsterLevel(scores.get(a.bgg_id), a) ?? -1;
          const lb = getMonsterLevel(scores.get(b.bgg_id), b) ?? -1;
          return lb - la || a.name.localeCompare(b.name);
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
      case "decorated":
        copy.sort((a, b) => {
          const da = decorationScore(a.bgg_id);
          const db = decorationScore(b.bgg_id);
          return db - da || a.name.localeCompare(b.name);
        });
        break;
    }
    return copy;
  }, [games, sort, scores, categories, ownedOnly, ownedIds, decorationScore]);

  const shown = sorted;

  return (
    <div className="flex flex-col gap-stack-loose">
      {/* Controls: filter chips (Board/Party/Owned) on one row, sort below */}
      <div className="flex flex-col gap-3">
        {/* Filter row — funnel icon, category toggles, owned */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">filter_alt</span>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleCategory(opt.value)}
              className={`rune-chip flex items-center gap-2 rounded-full px-4 py-1.5 font-stat text-stat-label ${
                categories.has(opt.value) ? "active" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setOwnedOnly((v) => !v)}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 font-stat text-stat-label transition-all ${
              ownedOnly
                ? "border-secondary-container bg-secondary-container text-on-secondary-container shadow-[0_0_10px_rgba(117,253,0,0.2)]"
                : "rune-chip text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Owned
          </button>
        </div>

        {/* Sort row — left-aligned, wraps cleanly when narrow */}
        <div className="flex flex-wrap items-center justify-start gap-1.5">
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
              {opt.value === "bgg" ? (
                <BggMark className="h-4 w-4 shrink-0" />
              ) : (
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
              )}
              <span className="hidden lg:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Monster card grid */}
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((game) => (
          <GameCard
            key={game.bgg_id}
            game={game}
            avgScore={scores.get(game.bgg_id)}
            owned={ownedIds.has(game.bgg_id)}
            wishlisted={wishlistIds.has(game.bgg_id)}
            isAdmin={admin}
            badges={badgeMap[game.bgg_id]}
            onOwnershipToggle={handleOwnershipToggle}
            onWishlistToggle={handleWishlistToggle}
            onGameUpdated={handleGameUpdated}
          />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="py-stack-loose text-center text-on-surface-variant">
          No monsters match these filters.
        </p>
      )}

    </div>
  );
}
