"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { usePillIndicator } from "@/lib/use-pill-indicator";

interface CategoryToggleProps {
  category: "party" | "board";
  basePath: string;
}

export function CategoryToggle({ category, basePath }: CategoryToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { containerRef, setRef, pill } = usePillIndicator(category);

  function handleToggle(cat: "party" | "board") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", cat);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div
      ref={containerRef}
      className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
    >
      <div
        className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10"
        style={pill}
      />
      <button
        ref={(button) => setRef("party", button)}
        onClick={() => handleToggle("party")}
        className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          category === "party"
            ? "text-zinc-900 dark:text-zinc-50"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        Party Games
      </button>
      <button
        ref={(button) => setRef("board", button)}
        onClick={() => handleToggle("board")}
        className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          category === "board"
            ? "text-zinc-900 dark:text-zinc-50"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        Board Games
      </button>
    </div>
  );
}
