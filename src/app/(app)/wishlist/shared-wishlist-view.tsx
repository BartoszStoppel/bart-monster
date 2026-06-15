"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BoardGame } from "@/types/database";
import type { ProfileInfo } from "./wishlist-types";

type SharedSort = "popular" | "bgg-rating" | "name";

const SORT_OPTIONS: { value: SharedSort; label: string; icon: string }[] = [
  { value: "popular", label: "Most Wanted", icon: "local_fire_department" },
  { value: "bgg-rating", label: "BGG Rating", icon: "public" },
  { value: "name", label: "Name", icon: "sort_by_alpha" },
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
  borderColor = "border-outline-variant",
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
          className={`relative h-6 w-6 overflow-hidden rounded-full border ${borderColor} bg-surface-container-highest`}
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
            <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-on-surface-variant">
              {p.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
      {people.length > 6 && (
        <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${borderColor} bg-surface-container-highest text-[9px] font-bold text-on-surface-variant`}>
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
    <div className="flex flex-col gap-stack-loose">
      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-stat text-stat-label text-on-surface-variant">
          {items.length} game{items.length !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
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

      {items.length === 0 ? (
        <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
          <span className="material-symbols-outlined text-[40px] text-outline">redeem</span>
          <p className="text-on-surface-variant">
            No one has coveted any treasures yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-gutter">
          {sorted.map((item) => (
            <div
              key={item.game.bgg_id}
              className="monster-card flex items-center gap-gutter rounded-lg p-card-padding"
            >
              {/* Thumbnail */}
              <Link
                href={`/games/${item.game.bgg_id}`}
                className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-surface-container-lowest"
              >
                {item.game.thumbnail_url ? (
                  <Image
                    src={item.game.thumbnail_url}
                    alt={item.game.name}
                    fill
                    className="object-contain"
                    sizes="56px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
                    ?
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/games/${item.game.bgg_id}`}
                    className="truncate font-display text-headline-lg-mobile text-on-surface hover:text-primary"
                  >
                    {item.game.name}
                  </Link>
                  {item.game.category && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-stat text-[10px] ${
                        item.game.category === "party"
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {item.game.category === "party" ? "Party" : "Board"}
                    </span>
                  )}
                  {item.game.bgg_rating && (
                    <span className="flex shrink-0 items-center gap-1 font-stat text-stat-label text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px] text-outline">public</span>
                      {Number(item.game.bgg_rating).toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Wishlisters */}
                  <div className="flex items-center gap-1.5">
                    <AvatarRow people={item.wishlisters} />
                    <span className="font-stat text-[10px] text-on-surface-variant">
                      {item.wishlisters.length} want{item.wishlisters.length === 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Owners */}
                  {item.owners.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AvatarRow
                        people={item.owners}
                        borderColor="border-secondary-container"
                      />
                      <span className="font-stat text-[10px] text-secondary">
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
