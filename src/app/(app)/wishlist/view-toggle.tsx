"use client";

import { useRouter, usePathname } from "next/navigation";
import type { ProfileInfo } from "./wishlist-types";

interface ViewToggleProps {
  currentUserId: string;
  selectedUserId: string | null;
  isShared: boolean;
  usersWithWishlists: ProfileInfo[];
}

export function ViewToggle({
  currentUserId,
  selectedUserId,
  isShared,
  usersWithWishlists,
}: ViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    if (value === "mine") {
      router.push(pathname);
    } else if (value === "shared") {
      router.push(`${pathname}?view=shared`);
    } else {
      router.push(`${pathname}?user=${value}`);
    }
  }

  const currentValue = isShared
    ? "shared"
    : selectedUserId && selectedUserId !== currentUserId
      ? selectedUserId
      : "mine";

  return (
    <select
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-300 focus:border-cyan-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white/20 dark:focus:border-cyan-400"
    >
      <option value="mine">My Wishlist</option>
      <option value="shared">Everyone</option>
      {usersWithWishlists
        .filter((u) => u.userId !== currentUserId)
        .map((u) => (
          <option key={u.userId} value={u.userId}>
            {u.displayName}&apos;s Wishlist
          </option>
        ))}
    </select>
  );
}
