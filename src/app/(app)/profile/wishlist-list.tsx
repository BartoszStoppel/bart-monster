"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface WishlistItem {
  bggId: number;
  name: string;
}

interface WishlistListProps {
  items: WishlistItem[];
  userId: string;
}

export function WishlistList({ items: initialItems, userId }: WishlistListProps) {
  const [items, setItems] = useState(initialItems);

  async function handleRemove(bggId: number) {
    setItems((prev) => prev.filter((i) => i.bggId !== bggId));

    const supabase = createClient();
    const { error } = await supabase
      .from("user_game_collection")
      .update({ wishlist: false })
      .eq("user_id", userId)
      .eq("bgg_id", bggId);

    if (error) {
      setItems((prev) => {
        const removed = initialItems.find((i) => i.bggId === bggId);
        return removed ? [...prev, removed] : prev;
      });
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        No games on your wishlist yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-outline-variant">
      {items.map((item) => (
        <li key={item.bggId} className="flex items-center justify-between py-2">
          <Link
            href={`/games/${item.bggId}`}
            className="flex items-center gap-2 text-sm font-medium text-on-surface transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined text-[16px] text-outline">star</span>
            {item.name}
          </Link>
          <button
            onClick={() => handleRemove(item.bggId)}
            title="Remove from wishlist"
            className="ml-3 flex items-center justify-center rounded p-1 text-on-surface-variant transition-colors hover:bg-error-container/15 hover:text-error"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
