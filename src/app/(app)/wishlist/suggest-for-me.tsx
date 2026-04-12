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
    <div className="mt-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
        Suggested for you ({suggestions.length})
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {suggestions.map((s) => {
            const isAdded = added.has(s.game.bgg_id);
            return (
              <div
                key={s.game.bgg_id}
                className="flex flex-col rounded-lg border border-zinc-200 bg-white p-2 dark:border-white/[0.06] dark:bg-white/5"
              >
                {/* Thumbnail + match badge */}
                <Link
                  href={`/games/${s.game.bgg_id}`}
                  className="relative mx-auto h-24 w-20 overflow-hidden rounded bg-zinc-100 dark:bg-white/5"
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
                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                      ?
                    </div>
                  )}
                  <span className="absolute top-0.5 right-0.5 rounded bg-cyan-600/90 px-1 py-0.5 text-[9px] font-bold text-white">
                    {Math.round(s.matchScore * 100)}%
                  </span>
                </Link>

                {/* Name */}
                <Link
                  href={`/games/${s.game.bgg_id}`}
                  className="mt-1.5 truncate text-xs font-medium text-zinc-900 hover:text-cyan-600 dark:text-zinc-100 dark:hover:text-cyan-400"
                >
                  {s.game.name}
                </Link>

                {/* Matching tags */}
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {s.matchingMechanics.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="rounded bg-cyan-50 px-1 py-0.5 text-[8px] text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300"
                    >
                      {m}
                    </span>
                  ))}
                  {s.matchingCategories.slice(0, 1).map((c) => (
                    <span
                      key={c}
                      className="rounded bg-purple-50 px-1 py-0.5 text-[8px] text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {/* Add button */}
                <button
                  onClick={() => handleAdd(s.game.bgg_id)}
                  disabled={isAdded || pending}
                  className={`mt-auto rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                    isAdded
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-zinc-100 text-zinc-600 hover:bg-cyan-100 hover:text-cyan-700 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-300"
                  }`}
                >
                  {isAdded ? "Added" : "+ Wishlist"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
