"use client";

import { useState } from "react";
import { setUserAdmin } from "./actions";

interface UserRoleToggleProps {
  userId: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isSelf: boolean;
}

/**
 * Toggle button for a single user's admin status.
 */
export function UserRoleToggle({
  userId,
  displayName,
  email,
  isAdmin,
  isSelf,
}: UserRoleToggleProps) {
  const [updating, setUpdating] = useState(false);

  async function handleToggle() {
    setUpdating(true);
    await setUserAdmin(userId, !isAdmin);
    setUpdating(false);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {displayName}
          </span>
          {isAdmin && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              Admin
            </span>
          )}
        </div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {email}
        </span>
      </div>
      <button
        onClick={handleToggle}
        disabled={updating || isSelf}
        title={isSelf ? "You cannot remove your own admin role" : undefined}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          isAdmin
            ? "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            : "border border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
        }`}
      >
        {updating ? "..." : isAdmin ? "Remove Admin" : "Make Admin"}
      </button>
    </div>
  );
}
