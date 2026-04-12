"use client";

import { useState } from "react";
import Link from "next/link";
import { GameSearchBar } from "@/components/game-search-bar";
import type { BggSearchResult, BggGameDetails } from "@/lib/bgg/types";
import { AddGameForm } from "./add-game-form";

interface AddedGame {
  bggId: number;
  name: string;
}

export default function SearchPage() {
  const [fetching, setFetching] = useState(false);
  const [gameDetails, setGameDetails] = useState<BggGameDetails | null>(null);
  const [added, setAdded] = useState<AddedGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(searchResult: BggSearchResult) {
    setError(null);
    setGameDetails(null);
    setFetching(true);

    const res = await fetch(`/api/bgg/game/${searchResult.id}`);
    if (!res.ok) {
      setError("Failed to fetch game details from BGG");
      setFetching(false);
      return;
    }

    const { game } = await res.json();
    setGameDetails(game);
    setFetching(false);
  }

  function handleAdded(bggId: number, name: string) {
    setGameDetails(null);
    setAdded((prev) => [...prev, { bggId, name }]);
  }

  function handleCancel() {
    setGameDetails(null);
  }

  function handleError(message: string) {
    setError(message);
  }

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" />
        </svg>
        Back to Collection
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Search Games
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Search BoardGameGeek and add games to the group collection
      </p>

      <GameSearchBar onSelect={handleSelect} />

      {fetching && (
        <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300">
          Fetching game details...
        </div>
      )}

      {gameDetails && (
        <AddGameForm
          game={gameDetails}
          onAdded={handleAdded}
          onCancel={handleCancel}
          onError={handleError}
        />
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
