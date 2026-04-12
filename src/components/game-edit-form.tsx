"use client";

import { useState, useRef, useEffect } from "react";
import { updateGame } from "@/app/(app)/actions";
import type { BoardGame } from "@/types/database";

interface GameEditFormProps {
  game: BoardGame;
  onClose: () => void;
  onSaved: (updated: Partial<BoardGame>) => void;
}

export function GameEditForm({ game, onClose, onSaved }: GameEditFormProps) {
  const [category, setCategory] = useState(game.category);
  const [minPlayers, setMinPlayers] = useState(game.min_players?.toString() ?? "");
  const [maxPlayers, setMaxPlayers] = useState(game.max_players?.toString() ?? "");
  const [playingTime, setPlayingTime] = useState(game.playing_time?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function clampOnBlur(
    raw: string,
    min: number,
    max: number,
    setter: (v: string) => void
  ) {
    if (raw === "") return;
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < min) setter(String(min));
    else if (n > max) setter(String(max));
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      bggId: game.bgg_id,
      category,
      minPlayers: minPlayers ? Number(minPlayers) : null,
      maxPlayers: maxPlayers ? Number(maxPlayers) : null,
      playingTime: playingTime ? Number(playingTime) : null,
    };

    try {
      await updateGame(payload);
      onSaved({
        category: payload.category,
        min_players: payload.minPlayers,
        max_players: payload.maxPlayers,
        playing_time: payload.playingTime,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={formRef}
      className="absolute top-0 left-0 z-50 w-full rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-white/5"
    >
      <h4 className="mb-2 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
        Edit {game.name}
      </h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "party" | "board")}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="board">Board Game</option>
            <option value="party">Party Game</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Min Players</span>
            <input
              type="number"
              value={minPlayers}
              onChange={(e) => setMinPlayers(e.target.value)}
              onBlur={() => clampOnBlur(minPlayers, 1, 99, setMinPlayers)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Max Players</span>
            <input
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              onBlur={() => clampOnBlur(maxPlayers, 1, 99, setMaxPlayers)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            />
          </label>
        </div>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Play Time (min)</span>
          <input
            type="number"
            value={playingTime}
            onChange={(e) => setPlayingTime(e.target.value)}
            onBlur={() => clampOnBlur(playingTime, 1, 999, setPlayingTime)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          />
        </label>
        {error && (
          <p className="text-[10px] text-red-500">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded bg-gradient-to-r from-cyan-500 to-cyan-600 px-2 py-1 text-xs font-medium text-white transition-colors shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
