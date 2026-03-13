"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BggGameDetails } from "@/lib/bgg/types";

type GameCategory = "party" | "board";

interface AddGameFormProps {
  game: BggGameDetails;
  onAdded: (bggId: number, name: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

/**
 * Editable form shown after fetching BGG details.
 * Lets users adjust player count and playtime before saving.
 */
export function AddGameForm({ game, onAdded, onCancel, onError }: AddGameFormProps) {
  const [category, setCategory] = useState<GameCategory | null>(null);
  const [minPlayers, setMinPlayers] = useState(game.minPlayers || 1);
  const [maxPlayers, setMaxPlayers] = useState(game.maxPlayers || 1);
  const [playingTime, setPlayingTime] = useState(game.playingTime || 30);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("board_games").upsert(
      {
        bgg_id: game.id,
        name: game.name,
        description: game.description,
        image_url: game.imageUrl,
        thumbnail_url: game.thumbnailUrl,
        year_published: game.yearPublished,
        min_players: minPlayers,
        max_players: maxPlayers,
        playing_time: playingTime,
        min_play_time: game.minPlayTime,
        max_play_time: game.maxPlayTime,
        min_age: game.minAge,
        bgg_rating: game.bggRating,
        bgg_weight: game.bggWeight,
        categories: game.categories,
        mechanics: game.mechanics,
        category,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "bgg_id" }
    );

    if (error) {
      onError("Failed to save game");
      setSaving(false);
      return;
    }

    onAdded(game.id, game.name);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <p className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Adding <span className="font-bold">{game.name}</span>
        {game.yearPublished ? ` (${game.yearPublished})` : ""}
      </p>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Category
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategory("party")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              category === "party"
                ? "bg-purple-600 text-white"
                : "border border-zinc-300 text-zinc-600 hover:border-purple-400 hover:text-purple-600 dark:border-zinc-600 dark:text-zinc-400"
            }`}
          >
            Party Game
          </button>
          <button
            type="button"
            onClick={() => setCategory("board")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              category === "board"
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 text-zinc-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-600 dark:text-zinc-400"
            }`}
          >
            Board Game
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="minPlayers"
            className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            Min Players
          </label>
          <input
            id="minPlayers"
            type="number"
            min={1}
            max={99}
            value={minPlayers}
            onChange={(e) => setMinPlayers(parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="maxPlayers"
            className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            Max Players
          </label>
          <input
            id="maxPlayers"
            type="number"
            min={1}
            max={99}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="playingTime"
            className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            Play Time (min)
          </label>
          <input
            id="playingTime"
            type="number"
            min={1}
            max={9999}
            value={playingTime}
            onChange={(e) => setPlayingTime(parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
      </div>

      <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">
        BGG says {game.minPlayers}–{game.maxPlayers} players, {game.playingTime} min.
        Adjust to match your group&apos;s experience.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !category}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add to Collection"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
