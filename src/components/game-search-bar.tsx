"use client";

import { useState, useEffect, useRef } from "react";
import type { BggSearchResult } from "@/lib/bgg/types";

interface GameSearchBarProps {
  onSelect: (game: BggSearchResult) => void;
}

export function GameSearchBar({ onSelect }: GameSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BggSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/bgg/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setShowDropdown(true);
      setLoading(false);
    }, 400);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Search for a board game..."
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />

      {loading && (
        <div className="absolute right-3 top-3.5 text-xs text-zinc-400">
          Searching...
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.slice(0, 20).map((game) => (
            <li key={game.id}>
              <button
                onClick={() => handleSelect(game)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {game.name}
                </span>
                {game.yearPublished && (
                  <span className="text-xs text-zinc-400">
                    {game.yearPublished}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDropdown && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          No games found
        </div>
      )}
    </div>
  );
}
