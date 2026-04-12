"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { WishlistItem, ProfileInfo } from "./wishlist-types";
import { moveToOwned, removeFromWishlist } from "./actions";

function weightColor(w: number): string {
  if (w < 2) return "text-green-600 dark:text-green-400";
  if (w < 3) return "text-yellow-600 dark:text-yellow-400";
  if (w < 4) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

const CATEGORY_LABELS: Record<string, string> = {
  party: "Party",
  board: "Board",
};

const PRIORITY_OPTIONS = [
  { value: 1, label: "Must Have", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800" },
  { value: 2, label: "Want", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  { value: 3, label: "Nice to Have", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
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
            className="relative h-5 w-5 overflow-hidden rounded-full border border-white bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-700"
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
              <span className="flex h-full w-full items-center justify-center text-[8px] font-bold text-zinc-500 dark:text-zinc-400">
                {p.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        ))}
        {people.length > 4 && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-300 text-[8px] font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-600 dark:text-zinc-300">
            +{people.length - 4}
          </div>
        )}
      </div>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
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
    <div className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-white/[0.06] dark:bg-white/5 dark:hover:border-white/10">
      {/* Thumbnail */}
      <Link
        href={`/games/${game.bgg_id}`}
        className="relative h-20 w-16 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-white/5"
      >
        {game.thumbnail_url ? (
          <Image
            src={game.thumbnail_url}
            alt={game.name}
            fill
            className="object-contain"
            sizes="64px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            ?
          </div>
        )}
      </Link>

      {/* Middle: info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/games/${game.bgg_id}`}
            className="truncate text-sm font-semibold text-zinc-900 hover:text-cyan-600 dark:text-zinc-50 dark:hover:text-cyan-400"
          >
            {game.name}
          </Link>
          {game.category && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                game.category === "party"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                  : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
              }`}
            >
              {CATEGORY_LABELS[game.category] ?? game.category}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {playerRange && <span>{playerRange}</span>}
          {game.playing_time && <span>{game.playing_time}min</span>}
          {game.bgg_weight && (
            <span className={`font-medium ${weightColor(Number(game.bgg_weight))}`}>
              Wt {Number(game.bgg_weight).toFixed(1)}
            </span>
          )}
          {game.bgg_rating && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              BGG {Number(game.bgg_rating).toFixed(1)}
            </span>
          )}
          {item.communityScore != null && (
            <span className="font-semibold text-cyan-600 dark:text-cyan-400">
              Ours {item.communityScore.toFixed(1)}
            </span>
          )}
        </div>

        {/* Priority pills */}
        {readOnly ? (
          priority != null && (
            <div className="flex items-center gap-1">
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                  PRIORITY_OPTIONS.find((o) => o.value === priority)?.color ??
                  "border-zinc-200 text-zinc-400 dark:border-white/10 dark:text-zinc-500"
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
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  priority === opt.value
                    ? opt.color
                    : "border-zinc-200 text-zinc-400 hover:border-zinc-300 dark:border-white/10 dark:text-zinc-500 dark:hover:border-white/20"
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
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{note}</p>
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
              className="flex-1 resize-none rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none focus:border-cyan-500 dark:border-white/10 dark:text-zinc-300 dark:focus:border-cyan-400"
              placeholder="Add a note..."
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="self-start text-[11px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            {note ? note : "+ note"}
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
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* BGG marketplace link */}
        <a
          href={`https://boardgamegeek.com/boardgame/${game.bgg_id}/marketplace`}
          target="_blank"
          rel="noopener noreferrer"
          title="BGG Marketplace"
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M8.543 2.232a.75.75 0 0 0-1.085 0l-5.25 5.5A.75.75 0 0 0 2.75 9H4v4a1 1 0 0 0 1 1h1.5a.5.5 0 0 0 .5-.5v-2a1 1 0 0 1 2 0v2a.5.5 0 0 0 .5.5H11a1 1 0 0 0 1-1V9h1.25a.75.75 0 0 0 .543-1.268l-5.25-5.5Z" />
          </svg>
        </a>

        {!readOnly && (
          <button
            onClick={handleRemove}
            title="Remove from wishlist"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
