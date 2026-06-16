"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GameEditForm } from "./game-edit-form";
import { getMonsterLevel, levelBadgeClass } from "@/lib/monster-level";
import { BggMark } from "@/components/bgg-mark";
import type { BoardGame } from "@/types/database";
import type { GameBadges, CategoryBadges } from "@/app/(app)/sortable-game-grid";

// Placement medals — Material Symbols `military_tech` tinted gold/silver/bronze
// for top-3, and a `skull` for last place. Same icon pack as the rest of the
// card, just recolored; the medal color carries the rank, tooltip the detail.
const MEDAL: Record<"gold" | "silver" | "bronze", string> = {
  gold: "#f3bd4e",
  silver: "#c5cad0",
  bronze: "#c47b3a",
};

function Coin({
  metal,
  count,
  title,
}: {
  metal: keyof typeof MEDAL;
  count: number;
  title: string;
}) {
  if (count === 0) return null;
  return (
    <span title={title} className="flex items-center gap-0.5">
      <span
        className="material-symbols-outlined text-[18px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        style={{ color: MEDAL[metal] }}
      >
        military_tech
      </span>
      {count > 1 && (
        <span className="font-stat text-[10px] font-bold text-on-surface drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          ×{count}
        </span>
      )}
    </span>
  );
}

function CullCoin({ count, title }: { count: number; title: string }) {
  if (count === 0) return null;
  return (
    <span title={title} className="flex items-center gap-0.5">
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
        skull
      </span>
      {count > 1 && (
        <span className="font-stat text-[10px] font-bold text-on-surface drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          ×{count}
        </span>
      )}
    </span>
  );
}

function BadgeRow({ cat, label }: { cat: CategoryBadges; label: string }) {
  const hasBadges = cat.gold.length > 0 || cat.silver.length > 0 || cat.bronze.length > 0 || cat.trash.length > 0;
  if (!hasBadges) return null;
  return (
    <div className="flex items-center gap-1">
      <Coin metal="gold" count={cat.gold.length} title={`#1 ${label} game for ${cat.gold.join(", ")}`} />
      <Coin metal="silver" count={cat.silver.length} title={`#2 ${label} game for ${cat.silver.join(", ")}`} />
      <Coin metal="bronze" count={cat.bronze.length} title={`#3 ${label} game for ${cat.bronze.join(", ")}`} />
      <CullCoin count={cat.trash.length} title={`Last place ${label} game for ${cat.trash.join(", ")}`} />
    </div>
  );
}

function Stat({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="material-symbols-outlined stat-icon text-[20px]">{icon}</span>
      <span className="font-stat text-stat-label text-on-surface">{value}</span>
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
      : "—";

  const imageUrl = game.image_url || game.thumbnail_url;
  const level = getMonsterLevel(avgScore, game);
  const genre =
    game.categories && game.categories.length > 0
      ? game.categories.slice(0, 2).join(" · ")
      : game.category === "party"
        ? "Party Game"
        : "Board Game";

  return (
    <article className="monster-card group relative flex h-[400px] cursor-pointer flex-col rounded-lg">
      {editing && (
        <GameEditForm
          game={game}
          onClose={() => setEditing(false)}
          onSaved={(updates) => onGameUpdated?.(game.bgg_id, updates)}
        />
      )}
      <Link href={`/games/${game.bgg_id}`} className="flex h-full flex-col">
        {/* Art (top 60%) */}
        <div className="relative h-[60%] w-full overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={game.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              style={{ viewTransitionName: `game-art-${game.bgg_id}` }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-container-lowest text-outline-variant">
              No image
            </div>
          )}
          {/* Art-to-stone fade — blends the art down into the stat block (Stitch: inset-0) */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent" />

          {/* Level badge */}
          {level != null && (
            <div className={`absolute left-3 top-3 z-20 rounded border bg-surface-container-highest px-2 py-1 font-stat text-stat-label shadow-sm ${levelBadgeClass(level)}`}>
              LVL {level}
            </div>
          )}

          {/* Owned + wishlist toggles */}
          <div className="absolute right-3 top-3 z-20 flex flex-col gap-1">
            {onOwnershipToggle && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOwnershipToggle(game.bgg_id); }}
                className={`flex h-6 w-6 items-center justify-center rounded transition-all ${
                  owned
                    ? "bg-secondary-container text-on-secondary-container shadow-sm shadow-secondary-container/40"
                    : "bg-surface-container-high/80 text-on-surface-variant opacity-0 backdrop-blur-sm group-hover:opacity-100"
                }`}
                title={owned ? "You own this" : "Not owned"}
              >
                <span className="material-symbols-outlined text-[16px]">{owned ? "check_circle" : "add_circle"}</span>
              </button>
            )}
            {onWishlistToggle && !owned && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWishlistToggle(game.bgg_id); }}
                className={`flex h-6 w-6 items-center justify-center rounded transition-all ${
                  wishlisted
                    ? "bg-primary-container text-on-primary-container shadow-sm shadow-primary-container/40"
                    : "bg-surface-container-high/80 text-on-surface-variant opacity-0 backdrop-blur-sm group-hover:opacity-100"
                }`}
                title={wishlisted ? "On your wishlist" : "Add to wishlist"}
              >
                <span className="material-symbols-outlined text-[16px]">{wishlisted ? "star" : "star_outline"}</span>
              </button>
            )}
          </div>

          {/* Medal / trash badges */}
          {(badges?.board || badges?.party) && (
            <div className="absolute bottom-2 right-2 z-20 flex flex-col items-end gap-0.5">
              {badges?.board && <BadgeRow cat={badges.board} label="board" />}
              {badges?.party && <BadgeRow cat={badges.party} label="party" />}
            </div>
          )}

          {/* Score chips */}
          <div className="absolute bottom-2 left-3 z-20 flex items-center gap-1.5">
            {avgScore != null && (
              <div className="flex items-center gap-1 rounded bg-primary-container/90 px-1.5 py-0.5 shadow-lg shadow-primary-container/25 backdrop-blur-sm">
                <span className="font-stat text-[9px] font-medium text-on-primary-container/80">Ours</span>
                <span className="font-stat text-xs font-bold text-on-primary-container">{avgScore.toFixed(1)}</span>
              </div>
            )}
            {game.bgg_rating ? (
              <div className="flex items-center gap-1 rounded border border-outline-variant bg-surface-container-highest/90 px-1.5 py-0.5 text-on-surface shadow-lg backdrop-blur-sm">
                <BggMark className="h-3 w-3 shrink-0" />
                <span className="font-stat text-xs font-bold">{game.bgg_rating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stat block (bottom 40%) */}
        <div className="relative z-20 flex flex-grow flex-col justify-between bg-surface-container-low p-card-padding">
          <div>
            <h3 className="mb-1 truncate font-display text-headline-lg-mobile text-on-surface">
              {game.name}
            </h3>
            <p className="truncate font-body text-caption text-on-surface-variant">{genre}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-surface-variant pt-4">
            <Stat icon="group" value={playerRange} />
            <div className="border-l border-r border-surface-variant">
              <Stat icon="hourglass_empty" value={game.playing_time ? `${game.playing_time}m` : "—"} />
            </div>
            <Stat icon="fitness_center" value={game.bgg_weight ? game.bgg_weight.toFixed(1) : "—"} />
          </div>
        </div>
      </Link>

      {admin && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="absolute right-2 bottom-2 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100"
          title="Edit game"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
        </button>
      )}
    </article>
  );
}
