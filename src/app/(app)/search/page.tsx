"use client";

import { useState } from "react";
import { GameSearchBar } from "@/components/game-search-bar";
import { createClient } from "@/lib/supabase/client";
import type { BggSearchResult } from "@/lib/bgg/types";

interface AddedGame {
  bggId: number;
  name: string;
}

export default function SearchPage() {
  const [adding, setAdding] = useState<number | null>(null);
  const [added, setAdded] = useState<AddedGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(searchResult: BggSearchResult) {
    setAdding(searchResult.id);
    setError(null);

    const res = await fetch(`/api/bgg/game/${searchResult.id}`);
    if (!res.ok) {
      setError("Failed to fetch game details from BGG");
      setAdding(null);
      return;
    }

    const { game } = await res.json();
    const supabase = createClient();

    const { error: upsertError } = await supabase.from("board_games").upsert(
      {
        bgg_id: game.id,
        name: game.name,
        description: game.description,
        image_url: game.imageUrl,
        thumbnail_url: game.thumbnailUrl,
        year_published: game.yearPublished,
        min_players: game.minPlayers,
        max_players: game.maxPlayers,
        playing_time: game.playingTime,
        min_play_time: game.minPlayTime,
        max_play_time: game.maxPlayTime,
        min_age: game.minAge,
        bgg_rating: game.bggRating,
        bgg_weight: game.bggWeight,
        categories: game.categories,
        mechanics: game.mechanics,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "bgg_id" }
    );

    if (upsertError) {
      setError("Failed to save game");
      setAdding(null);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("user_game_collection").upsert(
        {
          user_id: user.id,
          bgg_id: game.id,
          owned: true,
        },
        { onConflict: "user_id,bgg_id" }
      );
    }

    setAdded((prev) => [...prev, { bggId: game.id, name: game.name }]);
    setAdding(null);
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Search Games
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Search BoardGameGeek and add games to the group collection
      </p>

      <GameSearchBar onSelect={handleSelect} />

      {adding !== null && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Adding game to collection...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {added.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recently Added
          </h2>
          <ul className="space-y-2">
            {added.map((game) => (
              <li
                key={game.bggId}
                className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2 dark:border-green-800 dark:bg-green-900/20"
              >
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  {game.name}
                </span>
                <a
                  href={`/games/${game.bggId}`}
                  className="text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
