"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GameEditForm } from "@/components/game-edit-form";
import type { BoardGame } from "@/types/database";

interface EditGameButtonProps {
  game: BoardGame;
}

export function EditGameButton({ game }: EditGameButtonProps) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        onClick={() => setEditing(true)}
        className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Edit
      </button>
      {editing && (
        <div className="absolute top-0 left-0 z-50 w-64">
          <GameEditForm
            game={game}
            onClose={() => setEditing(false)}
            onSaved={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}
