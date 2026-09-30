"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { BggSearchResult } from "@/lib/bgg/types";

interface GameSearchBarProps {
  initialQuery?: string;
  onSelect: (game: BggSearchResult) => void;
}

export function GameSearchBar({
  onSelect,
  initialQuery = "",
}: GameSearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BggSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/bgg/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Search unavailable. Please try again.");
        const data = await res.json();
        if (controller.signal.aborted) return;
        setResults(data.results ?? []);
        setShowDropdown(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setShowDropdown(false);
        setError(
          error instanceof Error
            ? error.message
            : "Search unavailable. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function handleSelect(game: BggSearchResult) {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    onSelect(game);
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          if (val.trim().length < 2) {
            setResults([]);
            setShowDropdown(false);
          }
        }}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Search for a board game..."
        className="carved-input w-full rounded-lg px-4 py-3 text-sm placeholder-on-surface-variant/60 focus:outline-none"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}

      {loading && (
        <div className="absolute right-3 top-3.5 text-xs text-on-surface-variant">
          Searching...
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-high shadow-lg">
          {results.slice(0, 20).map((game) => (
            <li key={game.id}>
              <button
                onClick={() => handleSelect(game)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-highest"
              >
                {game.thumbnailUrl ? (
                  <Image
                    src={game.thumbnailUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded border border-outline-variant object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded border border-outline-variant bg-surface-container-highest" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-on-surface">
                    {game.name}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {[
                      game.yearPublished,
                      game.minPlayers && game.maxPlayers
                        ? `${game.minPlayers}–${game.maxPlayers} players`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDropdown &&
        !loading &&
        results.length === 0 &&
        query.length >= 2 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high p-4 text-center text-sm text-on-surface-variant shadow-lg">
            No games found
          </div>
        )}
    </div>
  );
}
