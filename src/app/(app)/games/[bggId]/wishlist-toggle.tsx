"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface WishlisterInfo {
  displayName: string;
  userId: string;
}

interface WishlistToggleProps {
  bggId: number;
  initialWishlisters: WishlisterInfo[];
  initialWishlisted: boolean;
  currentUserId: string;
  owned?: boolean;
}

export function WishlistToggle({
  bggId,
  initialWishlisters,
  initialWishlisted,
  currentUserId,
  owned,
}: WishlistToggleProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [wishlisters, setWishlisters] = useState(initialWishlisters);
  const [updating, setUpdating] = useState(false);

  async function handleToggle() {
    const adding = !wishlisted;
    setUpdating(true);

    const supabase = createClient();

    if (adding) {
      const { error } = await supabase.from("user_game_collection").upsert(
        { user_id: currentUserId, bgg_id: bggId, wishlist: true, owned: false },
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

      setWishlisted(true);
      setWishlisters((prev) => [
        ...prev,
        { displayName: profile?.display_name ?? "You", userId: currentUserId },
      ]);
    } else {
      const { error } = await supabase
        .from("user_game_collection")
        .update({ wishlist: false })
        .eq("user_id", currentUserId)
        .eq("bgg_id", bggId);

      if (error) {
        setUpdating(false);
        return;
      }

      setWishlisted(false);
      setWishlisters((prev) => prev.filter((w) => w.userId !== currentUserId));
    }

    setUpdating(false);
  }

  return (
    <div className="mt-2">
      {!owned && (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <button
            type="button"
            role="checkbox"
            aria-checked={wishlisted}
            onClick={handleToggle}
            disabled={updating}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50 ${
              wishlisted
                ? "border-purple-500 bg-purple-500 text-white"
                : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500"
            }`}
          >
            {wishlisted && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          Wishlist
        </label>
      )}

      {wishlisters.length > 0 && (
        <div className={owned ? "" : "mt-2"}>
          <span className="text-xs text-zinc-400">
            Wishlisted by ({wishlisters.length}):{" "}
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            {wishlisters.map((w) => w.displayName).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
