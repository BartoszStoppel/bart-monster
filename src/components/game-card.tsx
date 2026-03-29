"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GameEditForm } from "./game-edit-form";
import { useDominantColor } from "@/lib/use-dominant-color";
import type { BoardGame } from "@/types/database";
import type { GameBadges, CategoryBadges } from "@/app/(app)/sortable-game-grid";

function BadgeRow({ cat, label }: { cat: CategoryBadges; label: string }) {
  const hasBadges = cat.gold.length > 0 || cat.silver.length > 0 || cat.bronze.length > 0 || cat.trash.length > 0;
  if (!hasBadges) return null;
  return (
    <div className="flex gap-0.5">
      {cat.gold.length > 0 && (
        <span className="flex items-center rounded-md bg-black/50 px-1 py-0.5 text-[10px] leading-none shadow" title={`#1 ${label} game for ${cat.gold.join(", ")}`}>
          <span>🥇</span>{cat.gold.length > 1 && <span className="ml-0.5 font-bold text-white">{cat.gold.length}</span>}
        </span>
      )}
      {cat.silver.length > 0 && (
        <span className="flex items-center rounded-md bg-black/50 px-1 py-0.5 text-[10px] leading-none shadow" title={`#2 ${label} game for ${cat.silver.join(", ")}`}>
          <span>🥈</span>{cat.silver.length > 1 && <span className="ml-0.5 font-bold text-white">{cat.silver.length}</span>}
        </span>
      )}
      {cat.bronze.length > 0 && (
        <span className="flex items-center rounded-md bg-black/50 px-1 py-0.5 text-[10px] leading-none shadow" title={`#3 ${label} game for ${cat.bronze.join(", ")}`}>
          <span>🥉</span>{cat.bronze.length > 1 && <span className="ml-0.5 font-bold text-white">{cat.bronze.length}</span>}
        </span>
      )}
      {cat.trash.length > 0 && (
        <span className="flex items-center rounded-md bg-black/50 px-1 py-0.5 text-[10px] leading-none shadow" title={`Last place ${label} game for ${cat.trash.join(", ")}`}>
          <span>🗑️</span>{cat.trash.length > 1 && <span className="ml-0.5 font-bold text-white">{cat.trash.length}</span>}
        </span>
      )}
    </div>
  );
}

interface GameCardProps {
  game: BoardGame;
  avgScore?: number;
  badges?: GameBadges;
  owned?: boolean;
  wishlisted?: boolean;
  isAdmin?: boolean;
  onOwnershipToggle?: (bggId: number) => void;
  onWishlistToggle?: (bggId: number) => void;
  onGameUpdated?: (bggId: number, updates: Partial<BoardGame>) => void;
}

export function GameCard({ game, avgScore, badges, owned, wishlisted, isAdmin: admin, onOwnershipToggle, onWishlistToggle, onGameUpdated }: GameCardProps) {
  const [editing, setEditing] = useState(false);
  const playerRange =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players}`
        : `${game.min_players}-${game.max_players}`
      : null;

  const imageUrl = game.image_url || game.thumbnail_url;
  const dominantColor = useDominantColor(imageUrl);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md dark:bg-zinc-900 ${
        dominantColor ? "" : "border-zinc-200 dark:border-zinc-800"
      }`}
      style={{
        borderColor: dominantColor
          ? `rgba(${dominantColor}, 0.4)`
          : undefined,
      }}
    >
      {/* Dominant color tint overlay */}
      {dominantColor && (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-20 dark:opacity-25"
          style={{ backgroundColor: `rgb(${dominantColor})` }}
        />
      )}
      {editing && (
        <GameEditForm
          game={game}
          onClose={() => setEditing(false)}
          onSaved={(updates) => onGameUpdated?.(game.bgg_id, updates)}
        />
      )}
      <Link
        href={`/games/${game.bgg_id}`}
        className="relative z-[1] flex flex-col"
      >
        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {/* Owned + Wishlist stacked indicators */}
          <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1">
            {onOwnershipToggle && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOwnershipToggle(game.bgg_id);
                }}
                className={`flex h-4.5 w-4.5 items-center justify-center rounded transition-all ${
                  owned
                    ? "bg-green-500 text-white shadow-sm"
                    : "bg-white/90 text-zinc-500 opacity-0 group-hover:opacity-100 dark:bg-zinc-700/90 dark:text-zinc-300"
                }`}
                title={owned ? "You own this" : "Not owned"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  {owned ? (
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  ) : (
                    <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-9ZM3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9Z" />
                  )}
                </svg>
              </button>
            )}
            {onWishlistToggle && !owned && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onWishlistToggle(game.bgg_id);
                }}
                className={`flex h-4.5 w-4.5 items-center justify-center rounded transition-all ${
                  wishlisted
                    ? "bg-purple-500 text-white shadow-sm"
                    : "bg-white/90 text-zinc-500 opacity-0 group-hover:opacity-100 dark:bg-zinc-700/90 dark:text-zinc-300"
                }`}
                title={wishlisted ? "On your wishlist" : "Add to wishlist"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                  <path d="M7.5 5.6 10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96a.996.996 0 0 0 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.71 11.04a.996.996 0 0 0 0-1.41z" />
                </svg>
              </button>
            )}
          </div>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={game.name}
              fill
              className="object-contain transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">
              No image
            </div>
          )}

          {/* Score overlays on image */}
          <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-0.5">
            {avgScore != null && (
              <div className="flex items-center gap-1 rounded-md bg-blue-600 px-1.5 py-0.5 shadow">
                <span className="text-[9px] font-medium text-blue-200">Ours</span>
                <span className="text-xs font-bold text-white">{avgScore.toFixed(1)}</span>
              </div>
            )}
            {game.bgg_rating ? (
              <div className="flex items-center gap-1 rounded-md bg-orange-500 px-1.5 py-0.5 shadow">
                <span className="text-[9px] font-medium text-orange-200">BGG</span>
                <span className="text-xs font-bold text-white">{game.bgg_rating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>

          {/* Medal and trash badges */}
          {(badges?.board || badges?.party) && (
            <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-0.5">
              {badges?.board && <BadgeRow cat={badges.board} label="board" />}
              {badges?.party && <BadgeRow cat={badges.party} label="party" />}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2">
          <h3 className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
            {game.name}
          </h3>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
            {game.year_published ? <span>♦ {game.year_published}</span> : null}
            {playerRange ? <span>♟ {playerRange}</span> : null}
            {game.playing_time ? <span>⏱ {game.playing_time}m</span> : null}
            {game.bgg_weight ? <span>⚖ {game.bgg_weight.toFixed(1)}</span> : null}
          </div>
        </div>
      </Link>
      {admin && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="absolute right-1.5 bottom-1.5 z-[11] flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/70 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
            <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
