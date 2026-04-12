"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface OwnerInfo {
  displayName: string;
  userId: string;
}

interface OwnershipToggleProps {
  bggId: number;
  initialOwners: OwnerInfo[];
  initialOwned: boolean;
  currentUserId: string;
  onOwnedChange?: (owned: boolean) => void;
}

/**
 * Lets any authenticated user toggle whether they own a game.
 * Displays all owners with a total count.
 */
export function OwnershipToggle({
  bggId,
  initialOwners,
  initialOwned,
  currentUserId,
  onOwnedChange,
}: OwnershipToggleProps) {
  const [owned, setOwned] = useState(initialOwned);
  const [owners, setOwners] = useState(initialOwners);
  const [updating, setUpdating] = useState(false);
  const [prevInitial, setPrevInitial] = useState({ initialOwned, initialOwners });

  if (prevInitial.initialOwned !== initialOwned || prevInitial.initialOwners !== initialOwners) {
    setPrevInitial({ initialOwned, initialOwners });
    setOwned(initialOwned);
    setOwners(initialOwners);
  }

  async function handleToggle() {
    const newOwned = !owned;
    setUpdating(true);

    const supabase = createClient();

    if (newOwned) {
      const { error } = await supabase.from("user_game_collection").upsert(
        {
          user_id: currentUserId,
          bgg_id: bggId,
          owned: true,
          wishlist: false,
        },
        { onConflict: "user_id,bgg_id" }
      );

      if (error) {
        setUpdating(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", currentUserId)
        .single();

      setOwned(true);
      onOwnedChange?.(true);
      setOwners((prev) => [
        ...prev,
        { displayName: profile?.display_name ?? "You", userId: currentUserId },
      ]);
    } else {
      const { error } = await supabase
        .from("user_game_collection")
        .update({ owned: false })
        .eq("user_id", currentUserId)
        .eq("bgg_id", bggId);

      if (error) {
        setUpdating(false);
        return;
      }

      setOwned(false);
      onOwnedChange?.(false);
      setOwners((prev) => prev.filter((o) => o.userId !== currentUserId));
    }

    setUpdating(false);
  }

  return (
    <div className="mt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <button
          type="button"
          role="checkbox"
          aria-checked={owned}
          onClick={handleToggle}
          disabled={updating}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50 ${
            owned
              ? "border-green-500 bg-green-500 text-white"
              : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-white/10 dark:bg-white/5 dark:hover:border-zinc-500"
          }`}
        >
          {owned && (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        Ownership
      </label>

      {owners.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-zinc-400">
            Owned by ({owners.length}):{" "}
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            {owners.map((o) => o.displayName).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
