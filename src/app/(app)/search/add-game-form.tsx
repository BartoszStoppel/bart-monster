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
      className="glass-card rounded-lg p-6"
    >
      <p className="mb-4 flex items-center gap-2 text-sm text-on-surface">
        <span className="material-symbols-outlined stat-icon text-[20px]">auto_fix_high</span>
        Binding <span className="font-display text-headline-lg-mobile text-on-surface">{game.name}</span>
        {game.yearPublished ? (
          <span className="font-stat text-stat-label text-on-surface-variant">({game.yearPublished})</span>
        ) : null}
      </p>

      <div className="mb-4">
        <label className="mb-1.5 block font-stat text-stat-label text-on-surface-variant">
          Category
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategory("party")}
            className={`rune-chip rounded-md px-4 py-2 text-sm font-medium ${
              category === "party" ? "active" : "text-on-surface-variant"
            }`}
          >
            Party Game
          </button>
          <button
            type="button"
            onClick={() => setCategory("board")}
            className={`rune-chip rounded-md px-4 py-2 text-sm font-medium ${
              category === "board" ? "active" : "text-on-surface-variant"
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
            className="mb-1.5 block font-stat text-stat-label text-on-surface-variant"
          >
            Min Players
          </label>
          <input
            id="minPlayers"
            type="number"
            value={minPlayers}
            onChange={(e) => setMinPlayers(e.target.value)}
            onBlur={() => handleBlur(minPlayers, 1, 99, setMinPlayers)}
            className="carved-input w-full rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="maxPlayers"
            className="mb-1.5 block font-stat text-stat-label text-on-surface-variant"
          >
            Max Players
          </label>
          <input
            id="maxPlayers"
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            onBlur={() => handleBlur(maxPlayers, 1, 99, setMaxPlayers)}
            className="carved-input w-full rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="playingTime"
            className="mb-1.5 block font-stat text-stat-label text-on-surface-variant"
          >
            Play Time (min)
          </label>
          <input
            id="playingTime"
            type="number"
            value={playingTime}
            onChange={(e) => setPlayingTime(e.target.value)}
            onBlur={() => handleBlur(playingTime, 1, 9999, setPlayingTime)}
            className="carved-input w-full rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <p className="mb-4 text-xs text-on-surface-variant">
        BGG says {game.minPlayers}–{game.maxPlayers} players, {game.playingTime} min.
        Adjust to match your group&apos;s experience.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !category}
          className="stone-button rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add to Collection"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
