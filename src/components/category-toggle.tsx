"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface CategoryToggleProps {
  category: "party" | "board";
  basePath: string;
}

export function CategoryToggle({ category, basePath }: CategoryToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleToggle(cat: "party" | "board") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", cat);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      <button
        onClick={() => handleToggle("party")}
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          category === "party"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        Party Games
      </button>
      <button
        onClick={() => handleToggle("board")}
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          category === "board"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        Board Games
      </button>
    </div>
  );
}
