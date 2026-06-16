"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getMonsterLevel, levelBadgeClass } from "@/lib/monster-level";
import type { WishlistItem, ProfileInfo } from "./wishlist-types";
import { moveToOwned, removeFromWishlist } from "./actions";

function weightColor(w: number): string {
  if (w < 2) return "text-secondary";
  if (w < 3) return "text-primary";
  if (w < 4) return "text-tertiary";
  return "text-error";
}

const CATEGORY_LABELS: Record<string, string> = {
  party: "Party",
  board: "Board",
};

const PRIORITY_OPTIONS = [
  { value: 1, label: "Must Have", color: "bg-error-container/15 text-error border-error" },
  { value: 2, label: "Want", color: "bg-primary-container/15 text-primary border-primary" },
  { value: 3, label: "Nice to Have", color: "bg-secondary-container/15 text-secondary border-secondary-container" },
] as const;

interface WishlistCardProps {
  item: WishlistItem;
  readOnly?: boolean;
  onRemove: (bggId: number) => void;
  onMoveToOwned: (bggId: number) => void;
}

function AvatarStack({ people, label }: { people: ProfileInfo[]; label: string }) {
  if (people.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {people.slice(0, 4).map((p) => (
          <div
            key={p.userId}
            title={p.displayName}
            className="relative h-5 w-5 overflow-hidden rounded-full border border-outline-variant bg-surface-container-highest"
          >
            {p.avatarUrl ? (
              <Image
                src={p.avatarUrl}
                alt={p.displayName}
                fill
                className="object-cover"
                sizes="20px"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[8px] font-bold text-on-surface-variant">
                {p.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        ))}
        {people.length > 4 && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest text-[8px] font-bold text-on-surface-variant">
            +{people.length - 4}
          </div>
        )}
      </div>
      <span className="text-[10px] text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

export function WishlistCard({ item, readOnly, onRemove, onMoveToOwned }: WishlistCardProps) {
  const { game } = item;
  const [priority, setPriority] = useState(item.priority);
  const [note, setNote] = useState(item.note ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [moving, setMoving] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const playerRange =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players}P`
        : `${game.min_players}-${game.max_players}P`
      : null;

  const level = getMonsterLevel(item.communityScore, game);

  async function handlePriority(value: number) {
    const prev = priority;
    const newVal = priority === value ? null : value;
    setPriority(newVal);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPriority(prev);
      return;
    }

    const { error } = await supabase
      .from("user_game_collection")
      .update({ wishlist_priority: newVal })
      .eq("user_id", user.id)
      .eq("bgg_id", game.bgg_id);

    if (error) {
      setPriority(prev);
    }
  }

  async function handleNoteSave() {
    setEditingNote(false);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_game_collection")
      .update({ wishlist_note: note || null })
      .eq("user_id", user.id)
      .eq("bgg_id", game.bgg_id);
  }

  async function handleMoveToOwned() {
    setMoving(true);
    onMoveToOwned(game.bgg_id);
    await moveToOwned(game.bgg_id);
  }

  async function handleRemove() {
    onRemove(game.bgg_id);
    await removeFromWishlist(game.bgg_id);
  }

  return (
    <div className="monster-card flex gap-gutter rounded-lg p-card-padding transition-colors">
      {/* Thumbnail + rarity header */}
      <Link
        href={`/games/${game.bgg_id}`}
        className="relative h-24 w-20 shrink-0 overflow-hidden rounded bg-surface-container-lowest"
      >
        {game.thumbnail_url ? (
          <Image
            src={game.thumbnail_url}
            alt={game.name}
            fill
            className="object-contain"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
            ?
          </div>
        )}
        {level != null && (
          <div className={`absolute left-1 top-1 z-10 rounded border bg-surface-container-highest px-1.5 py-0.5 font-stat text-[10px] shadow-sm ${levelBadgeClass(level)}`}>
            LVL {level}
          </div>
        )}
      </Link>

      {/* Middle: info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Link
            href={`/games/${game.bgg_id}`}
            className="truncate font-display text-headline-lg-mobile text-on-surface hover:text-primary"
          >
            {game.name}
          </Link>
          {game.category && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-stat text-[10px] ${
                game.category === "party"
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-primary-container text-on-primary-container"
              }`}
            >
              {CATEGORY_LABELS[game.category] ?? game.category}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-stat text-stat-label text-on-surface-variant">
          {playerRange && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined stat-icon text-[16px]">group</span>
              {playerRange}
            </span>
          )}
          {game.playing_time && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined stat-icon text-[16px]">hourglass_empty</span>
              {game.playing_time}m
            </span>
          )}
          {game.bgg_weight && (
            <span className={`flex items-center gap-1 ${weightColor(Number(game.bgg_weight))}`}>
              <span className="material-symbols-outlined text-[16px]">fitness_center</span>
              {Number(game.bgg_weight).toFixed(1)}
            </span>
          )}
          {game.bgg_rating && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-outline">public</span>
              {Number(game.bgg_rating).toFixed(1)}
            </span>
          )}
          {item.communityScore != null && (
            <span className="flex items-center gap-1 text-primary">
              <span className="material-symbols-outlined stat-icon text-[16px]">military_tech</span>
              {item.communityScore.toFixed(1)}
            </span>
          )}
        </div>

        {/* Priority pills */}
        {readOnly ? (
          priority != null && (
            <div className="flex items-center gap-1">
              <span
                className={`rounded-full border px-2 py-0.5 font-stat text-[10px] ${
                  PRIORITY_OPTIONS.find((o) => o.value === priority)?.color ??
                  "border-outline-variant text-on-surface-variant"
                }`}
              >
                {PRIORITY_OPTIONS.find((o) => o.value === priority)?.label}
              </span>
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePriority(opt.value)}
                className={`rounded-full border px-2 py-0.5 font-stat text-[10px] transition-colors ${
                  priority === opt.value
                    ? opt.color
                    : "border-outline-variant text-on-surface-variant hover:border-outline"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Note */}
        {readOnly ? (
          note && (
            <p className="text-[11px] text-on-surface-variant">{note}</p>
          )
        ) : editingNote ? (
          <div className="flex gap-1">
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteSave}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleNoteSave();
                }
              }}
              rows={2}
              autoFocus
              className="carved-input flex-1 resize-none rounded px-2 py-1 text-xs outline-none"
              placeholder="Add a note..."
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="flex items-center gap-1 self-start text-[11px] text-on-surface-variant transition-colors hover:text-on-surface"
          >
            {note ? (
              note
            ) : (
              <>
                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                Add a note
              </>
            )}
          </button>
        )}

        {/* Social: who wants / who owns */}
        <div className="flex flex-wrap items-center gap-3">
          <AvatarStack people={item.otherWishlisters} label="also want" />
          <AvatarStack people={item.owners} label="own it" />
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {!readOnly && (
          <button
            onClick={handleMoveToOwned}
            disabled={moving}
            title="Move to owned"
            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-secondary-container/15 hover:text-secondary"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
          </button>
        )}

        {/* BGG marketplace link */}
        <a
          href={`https://boardgamegeek.com/boardgame/${game.bgg_id}/marketplace`}
          target="_blank"
          rel="noopener noreferrer"
          title="BGG Marketplace"
          className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">storefront</span>
        </a>

        {!readOnly && (
          <button
            onClick={handleRemove}
            title="Remove from wishlist"
            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-error-container/15 hover:text-error"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
