"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BoardGame } from "@/types/database";
import type { ProfileInfo } from "./wishlist-types";

type SharedSort = "popular" | "bgg-rating" | "name";

const SORT_OPTIONS: { value: SharedSort; label: string }[] = [
  { value: "popular", label: "Most Wanted" },
  { value: "bgg-rating", label: "BGG Rating" },
  { value: "name", label: "Name" },
];

interface SharedItem {
  game: BoardGame;
  wishlisters: ProfileInfo[];
  owners: ProfileInfo[];
}

interface SharedWishlistViewProps {
  items: SharedItem[];
}

function AvatarRow({
  people,
  borderColor = "border-white dark:border-zinc-800",
}: {
  people: ProfileInfo[];
  borderColor?: string;
}) {
  return (
    <div className="flex -space-x-1.5">
      {people.slice(0, 6).map((p) => (
        <div
          key={p.userId}
          title={p.displayName}
          className={`relative h-6 w-6 overflow-hidden rounded-full border ${borderColor} bg-zinc-200 dark:bg-zinc-700`}
        >
          {p.avatarUrl ? (
            <Image
              src={p.avatarUrl}
              alt={p.displayName}
              fill
              className="object-cover"
              sizes="24px"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-zinc-500 dark:text-zinc-400">
              {p.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
      {people.length > 6 && (
        <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${borderColor} bg-zinc-300 text-[9px] font-bold text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300`}>
          +{people.length - 6}
        </div>
      )}
    </div>
  );
}

export function SharedWishlistView({ items }: SharedWishlistViewProps) {
  const [sort, setSort] = useState<SharedSort>("popular");

  const sorted = useMemo(() => {
    const copy = [...items];
    switch (sort) {
      case "popular":
        copy.sort((a, b) =>
          b.wishlisters.length - a.wishlisters.length || a.game.name.localeCompare(b.game.name)
        );
        break;
      case "bgg-rating":
        copy.sort((a, b) => {
          const ra = a.game.bgg_rating ?? 0;
          const rb = b.game.bgg_rating ?? 0;
          return rb - ra || a.game.name.localeCompare(b.game.name);
        });
        break;
      case "name":
        copy.sort((a, b) => a.game.name.localeCompare(b.game.name));
        break;
    }
    return copy;
  }, [items, sort]);

  return (
    <div>
      {/* Sort controls */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Sort</span>
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                sort === opt.value
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {items.length} game{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-white/[0.06] dark:bg-white/5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No one has wishlisted any games yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <div
              key={item.game.bgg_id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-white/[0.06] dark:bg-white/5"
            >
              {/* Thumbnail */}
              <Link
                href={`/games/${item.game.bgg_id}`}
                className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-white/5"
              >
                {item.game.thumbnail_url ? (
                  <Image
                    src={item.game.thumbnail_url}
                    alt={item.game.name}
                    fill
                    className="object-contain"
                    sizes="48px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                    ?
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/games/${item.game.bgg_id}`}
                    className="truncate text-sm font-semibold text-zinc-900 hover:text-cyan-600 dark:text-zinc-50 dark:hover:text-cyan-400"
                  >
                    {item.game.name}
                  </Link>
                  {item.game.category && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        item.game.category === "party"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                      }`}
                    >
                      {item.game.category === "party" ? "Party" : "Board"}
                    </span>
                  )}
                  {item.game.bgg_rating && (
                    <span className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      {Number(item.game.bgg_rating).toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Wishlisters */}
                  <div className="flex items-center gap-1.5">
                    <AvatarRow people={item.wishlisters} />
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {item.wishlisters.length} want{item.wishlisters.length === 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Owners */}
                  {item.owners.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AvatarRow
                        people={item.owners}
                        borderColor="border-green-200 dark:border-green-900"
                      />
                      <span className="text-[10px] text-green-600 dark:text-green-400">
                        {item.owners.length} own{item.owners.length === 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
