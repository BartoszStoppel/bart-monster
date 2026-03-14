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
      setOwners((prev) => prev.filter((o) => o.userId !== currentUserId));
    }

    setUpdating(false);
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={updating}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            owned
              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
              : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {owned ? "I own this" : "I don't own this"}
        </button>
      </div>

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
