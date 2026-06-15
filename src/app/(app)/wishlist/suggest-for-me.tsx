"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SuggestedGame } from "./wishlist-types";
import { addToWishlist } from "./actions";

interface SuggestForMeProps {
  suggestions: SuggestedGame[];
}

export function SuggestForMe({ suggestions }: SuggestForMeProps) {
  const [open, setOpen] = useState(true);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  function handleAdd(bggId: number) {
    setAdded((prev) => new Set(prev).add(bggId));
    startTransition(async () => {
      await addToWishlist(bggId);
    });
  }

  return (
    <div className="flex flex-col gap-stack-compact">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 font-display text-headline-lg-mobile text-on-surface transition-colors hover:text-primary"
      >
        <span className="material-symbols-outlined stat-icon text-[22px]">auto_awesome</span>
        Suggested for You ({suggestions.length})
        <span className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${open ? "rotate-90" : ""}`}>
          chevron_right
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-gutter sm:grid-cols-3 md:grid-cols-4">
          {suggestions.map((s) => {
            const isAdded = added.has(s.game.bgg_id);
            return (
              <div
                key={s.game.bgg_id}
                className="monster-card flex flex-col gap-2 rounded-lg p-card-padding"
              >
                {/* Thumbnail + match badge */}
                <Link
                  href={`/games/${s.game.bgg_id}`}
                  className="relative mx-auto h-24 w-20 overflow-hidden rounded bg-surface-container-lowest"
                >
                  {s.game.thumbnail_url ? (
                    <Image
                      src={s.game.thumbnail_url}
                      alt={s.game.name}
                      fill
                      className="object-contain"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
                      ?
                    </div>
                  )}
                  <span className="absolute right-0.5 top-0.5 rounded bg-primary-container/90 px-1 py-0.5 font-stat text-[9px] font-bold text-on-primary-container">
                    {Math.round(s.matchScore * 100)}%
                  </span>
                </Link>

                {/* Name */}
                <Link
                  href={`/games/${s.game.bgg_id}`}
                  className="truncate font-display text-sm font-medium text-on-surface hover:text-primary"
                >
                  {s.game.name}
                </Link>

                {/* Matching tags */}
                <div className="flex flex-wrap gap-0.5">
                  {s.matchingMechanics.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="rounded bg-primary-container/15 px-1 py-0.5 font-stat text-[8px] text-primary"
                    >
                      {m}
                    </span>
                  ))}
                  {s.matchingCategories.slice(0, 1).map((c) => (
                    <span
                      key={c}
                      className="rounded bg-secondary-container/15 px-1 py-0.5 font-stat text-[8px] text-secondary"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {/* Add button */}
                <button
                  onClick={() => handleAdd(s.game.bgg_id)}
                  disabled={isAdded || pending}
                  className={`mt-auto flex items-center justify-center gap-1 rounded px-2 py-1 font-stat text-[10px] font-medium transition-colors ${
                    isAdded
                      ? "bg-secondary-container/15 text-secondary"
                      : "bg-surface-container-highest text-on-surface-variant hover:bg-primary-container/15 hover:text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{isAdded ? "check" : "add"}</span>
                  {isAdded ? "Added" : "Wishlist"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
