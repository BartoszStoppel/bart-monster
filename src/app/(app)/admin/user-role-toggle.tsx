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
    <div className="glass-card flex items-center justify-between gap-4 rounded-lg p-card-padding">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-headline-lg-mobile text-on-surface">
            {displayName}
          </span>
          {isAdmin && (
            <span className="rune-chip active flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-stat text-caption">
              <span className="material-symbols-outlined text-[14px]">shield_person</span>
              Admin
            </span>
          )}
        </div>
        <span className="truncate text-on-surface-variant">{email}</span>
      </div>
      <button
        onClick={handleToggle}
        disabled={updating || isSelf}
        title={isSelf ? "You cannot remove your own admin role" : undefined}
        className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2 font-stat text-stat-label transition-colors disabled:opacity-50 ${
          isAdmin
            ? "border border-error text-error hover:bg-error-container/15"
            : "border border-secondary-container text-secondary hover:bg-secondary-container/15"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {isAdmin ? "remove_moderator" : "add_moderator"}
        </span>
        {updating ? "…" : isAdmin ? "Remove Admin" : "Make Admin"}
      </button>
    </div>
  );
}
