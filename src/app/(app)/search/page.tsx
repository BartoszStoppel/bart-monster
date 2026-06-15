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
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <Link
          href="/"
          className="inline-flex items-center gap-1 self-start font-stat text-stat-label text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to the Library
        </Link>
        <h1 className="font-display text-display-lg text-primary">Summon a Monster</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Search the BoardGameGeek bestiary and bind new creatures to the shared codex.
        </p>
      </section>

      <GameSearchBar onSelect={handleSelect} />

      {fetching && (
        <div className="glass-card flex items-center gap-2 rounded-lg p-card-padding font-stat text-stat-label text-primary">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Summoning game details...
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
        <div className="glass-card flex items-center gap-2 rounded-lg border-error p-card-padding font-stat text-stat-label text-error">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {added.length > 0 && (
        <section className="flex flex-col gap-stack-compact">
          <h2 className="font-display text-headline-lg-mobile text-on-surface">
            Recently Summoned
          </h2>
          <ul className="flex flex-col gap-2">
            {added.map((game) => (
              <li
                key={game.bggId}
                className="glass-card flex items-center justify-between rounded-lg border-secondary-container px-card-padding py-2"
              >
                <span className="flex items-center gap-2 font-stat text-stat-label text-secondary">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {game.name}
                </span>
                <a
                  href={`/games/${game.bggId}`}
                  className="font-stat text-stat-label text-secondary transition-colors hover:text-secondary-container"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
