"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { GameCard } from "@/components/game-card";
import { createClient } from "@/lib/supabase/client";
import type { BoardGame } from "@/types/database";

type SortOption = "ours" | "bgg" | "name" | "weight" | "decorated";
type CategoryFilter = "all" | "board" | "party";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "ours", label: "Our Rating" },
  { value: "bgg", label: "BGG Rating" },
  { value: "name", label: "Name" },
  { value: "weight", label: "Weight" },
  { value: "decorated", label: "Decorated" },
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          ref={catContainerRef}
          className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
        >
          <div
            className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10 dark:shadow-cyan-500/5"
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
            className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
          >
            <div
              className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10 dark:shadow-cyan-500/5"
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
        <button
          onClick={() => setOwnedOnly((v) => !v)}
          className={`ml-auto relative flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium transition-colors dark:bg-white/5 ${
            ownedOnly
              ? "text-green-600 dark:text-green-400"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          }`}
        >
          <span
            className={`inline-flex h-3 w-3 items-center justify-center rounded-sm border transition-colors ${
              ownedOnly
                ? "border-green-500 bg-green-500 text-white"
                : "border-zinc-400 dark:border-white/20"
            }`}
          >
            {ownedOnly && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            )}
          </span>
          Owned
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {sorted.map((game) => (
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
    </div>
  );
}
