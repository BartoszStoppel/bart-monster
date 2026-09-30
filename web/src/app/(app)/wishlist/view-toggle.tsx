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
      className="carved-input rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors"
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
