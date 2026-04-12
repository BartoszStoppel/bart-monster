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
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No games on your wishlist yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {items.map((item) => (
        <li key={item.bggId} className="flex items-center justify-between py-2">
          <Link
            href={`/games/${item.bggId}`}
            className="text-sm font-medium text-zinc-900 hover:text-cyan-600 dark:text-zinc-50 dark:hover:text-cyan-400"
          >
            {item.name}
          </Link>
          <button
            onClick={() => handleRemove(item.bggId)}
            className="ml-3 rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
