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
        className="rounded-md border border-error px-3 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error-container/15"
      >
        Remove Game
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-error">
          Delete {gameName}?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-error-container px-3 py-1.5 text-sm font-medium text-on-error-container transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Confirm"}
        </button>
        <button
          onClick={() => { setConfirming(false); setErrorMsg(null); }}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Cancel
        </button>
      </div>
      {errorMsg && (
        <p className="text-xs text-error">{errorMsg}</p>
      )}
    </div>
  );
}
