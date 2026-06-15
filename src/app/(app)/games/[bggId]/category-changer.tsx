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
      <span className="text-xs text-on-surface-variant">Category:</span>
      <div className="flex gap-1 rounded-md bg-surface-container-high p-0.5">
        <button
          onClick={() => handleChange("party")}
          disabled={updating}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            currentCategory === "party"
              ? "bg-secondary-container text-on-secondary-container"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Party
        </button>
        <button
          onClick={() => handleChange("board")}
          disabled={updating}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            currentCategory === "board"
              ? "bg-primary-container text-on-primary-container"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Board
        </button>
      </div>
      {updating && (
        <span className="text-xs text-on-surface-variant">Updating...</span>
      )}
    </div>
  );
}
