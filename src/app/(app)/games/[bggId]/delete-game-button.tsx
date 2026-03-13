"use client";

import { useState } from "react";
import { deleteGame } from "./actions";

interface DeleteGameButtonProps {
  bggId: number;
  gameName: string;
}

/**
 * Admin-only button to remove a game from the collection entirely.
 * Uses a server action so the delete runs server-side with proper auth.
 */
export function DeleteGameButton({ bggId, gameName }: DeleteGameButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setErrorMsg(null);

    try {
      await deleteGame(bggId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        Remove Game
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600 dark:text-red-400">
          Delete {gameName}?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => { setConfirming(false); setErrorMsg(null); }}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
      </div>
      {errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
