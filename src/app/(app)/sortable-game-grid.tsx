"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { GameCard } from "@/components/game-card";
import { createClient } from "@/lib/supabase/client";
import type { BoardGame } from "@/types/database";

type SortOption = "ours" | "bgg" | "name" | "weight" | "decorated";
type CategoryFilter = "all" | "board" | "party";

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: "ours", label: "Our Rating", icon: "trophy" },
  { value: "bgg", label: "BGG", icon: "public" },
  { value: "name", label: "Name", icon: "sort_by_alpha" },
  { value: "weight", label: "Weight", icon: "fitness_center" },
  { value: "decorated", label: "Decorated", icon: "military_tech" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string; icon: string }[] = [
  { value: "all", label: "All Species", icon: "apps" },
  { value: "board", label: "Board", icon: "castle" },
  { value: "party", label: "Party", icon: "celebration" },
];

const PAGE_SIZE = 24;

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
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
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
    let filtered = category === "all"
      ? games
      : games.filter((g) => g.category === category);
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
  }, [games, sort, scores, category, ownedOnly, ownedIds, decorationScore]);

  const shown = sorted.slice(0, visible);

  return (
    <div className="flex flex-col gap-stack-loose">
      {/* Rune-chip filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setCategory(opt.value); setVisible(PAGE_SIZE); }}
            className={`rune-chip flex items-center gap-2 rounded-full px-4 py-1.5 font-stat text-stat-label ${
              category === opt.value ? "active" : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
            {opt.label}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setOwnedOnly((v) => !v); setVisible(PAGE_SIZE); }}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 font-stat text-stat-label transition-all ${
              ownedOnly
                ? "border-secondary-container bg-secondary-container text-on-secondary-container shadow-[0_0_10px_rgba(117,253,0,0.2)]"
                : "rune-chip text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Owned
          </button>

          <div className="hidden items-center gap-1.5 sm:flex">
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
                  <Image src="/bgg-icon.png" alt="BGG" width={16} height={16} className="rounded-sm" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                )}
                <span className="hidden lg:inline">{opt.label}</span>
              </button>
            ))}
          </div>
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

      {visible < sorted.length && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="stone-button rounded-md px-8 py-3 font-stat text-stat-label"
          >
            Reveal More Monsters
          </button>
        </div>
      )}
    </div>
  );
}
