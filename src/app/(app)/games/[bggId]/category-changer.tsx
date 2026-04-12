"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface CategoryChangerProps {
  bggId: number;
  currentCategory: "party" | "board";
}

/**
 * Admin-only control to change a game's category (party/board).
 */
export function CategoryChanger({ bggId, currentCategory }: CategoryChangerProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function handleChange(category: "party" | "board") {
    if (category === currentCategory) return;
    setUpdating(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("board_games")
      .update({ category })
      .eq("bgg_id", bggId);

    if (error) {
      setUpdating(false);
      return;
    }

    router.refresh();
    setUpdating(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400">Category:</span>
      <div className="flex gap-1 rounded-md bg-zinc-100 p-0.5 dark:bg-white/5">
        <button
          onClick={() => handleChange("party")}
          disabled={updating}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            currentCategory === "party"
              ? "bg-purple-600 text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Party
        </button>
        <button
          onClick={() => handleChange("board")}
          disabled={updating}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            currentCategory === "board"
              ? "bg-cyan-600 text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Board
        </button>
      </div>
      {updating && (
        <span className="text-xs text-zinc-400">Updating...</span>
      )}
    </div>
  );
}
