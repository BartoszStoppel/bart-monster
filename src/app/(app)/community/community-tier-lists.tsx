"use client";

import Image from "next/image";
import type { BoardGame, Tier } from "@/types/database";
import { ReadOnlyTierRow } from "./read-only-tier-row";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

export interface UserTierData {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  buckets: Record<Tier, BoardGame[]>;
  gamesOwned: number;
}

interface CommunityTierListsProps {
  users: UserTierData[];
}

export function CommunityTierLists({ users }: CommunityTierListsProps) {
  if (users.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No one has created tier lists for this category yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {users.map((user) => (
        <section key={user.userId}>
          <div className="mb-2 flex items-center gap-2">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.displayName}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {user.displayName}
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {user.gamesOwned} {user.gamesOwned === 1 ? "game" : "games"} owned
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            {TIERS.map((tier) => (
              <ReadOnlyTierRow
                key={tier}
                tier={tier}
                games={user.buckets[tier]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
