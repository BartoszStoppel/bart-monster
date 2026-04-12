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
  const [minPlayers, setMinPlayers] = useState(String(game.minPlayers || 1));
  const [maxPlayers, setMaxPlayers] = useState(String(game.maxPlayers || 1));
  const [playingTime, setPlayingTime] = useState(String(game.playingTime || 30));
  const [saving, setSaving] = useState(false);

  function clampInt(raw: string, min: number, max: number): number {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < min) return min;
    if (n > max) return max;
    return n;
  }

  function handleBlur(
    raw: string,
    min: number,
    max: number,
    setter: (v: string) => void
  ) {
    setter(String(clampInt(raw, min, max)));
  }

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
        min_players: clampInt(minPlayers, 1, 99),
        max_players: clampInt(maxPlayers, 1, 99),
        playing_time: clampInt(playingTime, 1, 9999),
        min_play_time: game.minPlayTime,
        max_play_time: game.maxPlayTime,
        min_age: game.minAge,
        bgg_rating: game.bggRating,
        bgg_weight: game.bggWeight,
        categories: game.categories,
        mechanics: game.mechanics,
        designers: game.designers,
        artists: game.artists,
        publishers: game.publishers,
        alternate_names: game.alternateNames,
        expansions: game.expansions,
        bgg_users_rated: game.bggUsersRated || null,
        bgg_std_dev: game.bggStdDev || null,
        bgg_owned: game.bggOwned || null,
        bgg_wanting: game.bggWanting || null,
        bgg_wishing: game.bggWishing || null,
        bgg_num_weights: game.bggNumWeights || null,
        suggested_players: game.suggestedPlayers,
        suggested_age: game.suggestedAge,
        language_dependence: game.languageDependence,
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
      className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5"
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
                : "border border-zinc-300 text-zinc-600 hover:border-purple-400 hover:text-purple-600 dark:border-white/10 dark:text-zinc-400"
            }`}
          >
            Party Game
          </button>
          <button
            type="button"
            onClick={() => setCategory("board")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              category === "board"
                ? "bg-cyan-600 text-white"
                : "border border-zinc-300 text-zinc-600 hover:border-cyan-400 hover:text-cyan-600 dark:border-white/10 dark:text-zinc-400"
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
            value={minPlayers}
            onChange={(e) => setMinPlayers(e.target.value)}
            onBlur={() => handleBlur(minPlayers, 1, 99, setMinPlayers)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
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
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            onBlur={() => handleBlur(maxPlayers, 1, 99, setMaxPlayers)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
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
            value={playingTime}
            onChange={(e) => setPlayingTime(e.target.value)}
            onBlur={() => handleBlur(playingTime, 1, 9999, setPlayingTime)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
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
