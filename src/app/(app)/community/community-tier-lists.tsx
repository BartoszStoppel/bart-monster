"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { BoardGame, Tier } from "@/types/database";
import { ReadOnlyTierRow } from "./read-only-tier-row";
import type { TierGameEntry } from "./read-only-tier-row";
import {
  computeShadowRanks,
  buildScoreMap,
  type ShadowPlacement,
} from "./compute-shadow-ranks";

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
  allGames?: BoardGame[];
}

/** Compute top N category tags for a user weighted by their tier scores. */
function topTags(
  buckets: Record<Tier, BoardGame[]>,
  n: number,
): string[] {
  const scoreMap = buildScoreMap(buckets);
  const tagPoints = new Map<string, number>();

  for (const tier of TIERS) {
    for (const game of buckets[tier]) {
      const score = scoreMap.get(game.bgg_id) ?? 0;
      for (const cat of game.categories) {
        tagPoints.set(cat, (tagPoints.get(cat) ?? 0) + score);
      }
    }
  }

  return [...tagPoints.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag]) => tag);
}

/**
 * Find each user's hottest take: the game where their score is furthest
 * from the community average. Only considers games ranked by at least
 * half the users, and each user's hot take is chosen from games they
 * personally ranked.
 */
function computeHotTakes(
  users: UserTierData[],
): Map<string, number> {
  if (users.length < 2) return new Map();

  const minRaters = 3;

  const scoreMaps = new Map<string, Map<number, number>>();
  for (const user of users) {
    scoreMaps.set(user.userId, buildScoreMap(user.buckets));
  }

  // Count how many users ranked each game
  const raterCount = new Map<number, number>();
  for (const user of users) {
    for (const tier of TIERS) {
      for (const game of user.buckets[tier]) {
        raterCount.set(game.bgg_id, (raterCount.get(game.bgg_id) ?? 0) + 1);
      }
    }
  }

  // Eligible games: ranked by at least half the users
  const eligibleIds = [...raterCount.entries()]
    .filter(([, count]) => count >= minRaters)
    .map(([id]) => id);

  if (eligibleIds.length === 0) return new Map();

  // Community average per eligible game (only among users who ranked it)
  const groupAvg = new Map<number, number>();
  for (const bggId of eligibleIds) {
    let total = 0;
    let count = 0;
    for (const user of users) {
      const score = scoreMaps.get(user.userId)?.get(bggId);
      if (score !== undefined) {
        total += score;
        count++;
      }
    }
    groupAvg.set(bggId, total / count);
  }

  // For each user, find their game with max distance from community avg
  const hotTakes = new Map<string, number>();
  for (const user of users) {
    const userScores = scoreMaps.get(user.userId)!;
    let maxDev = -1;
    let hotId = -1;
    for (const bggId of eligibleIds) {
      const score = userScores.get(bggId);
      if (score === undefined) continue;
      const dev = Math.abs(score - groupAvg.get(bggId)!);
      if (dev > maxDev) {
        maxDev = dev;
        hotId = bggId;
      }
    }
    if (hotId >= 0) {
      hotTakes.set(user.userId, hotId);
    }
  }

  return hotTakes;
}

/**
 * Merge real games and shadow games into a single list, interleaved by score.
 * Real games keep their original order; shadow games are inserted at the
 * position matching their predicted score relative to real game scores.
 */
function interleaveEntries(
  realGames: BoardGame[],
  shadows: ShadowPlacement[],
  scoreMap: Map<number, number>,
): TierGameEntry[] {
  // Build scored entries for real games (already in position order = descending score)
  const scored: { entry: TierGameEntry; score: number }[] = realGames.map((game) => ({
    entry: { game, shadow: false },
    score: scoreMap.get(game.bgg_id) ?? 0,
  }));

  // Add shadow entries
  for (const sp of shadows) {
    scored.push({
      entry: { game: sp.game, shadow: true },
      score: sp.predictedScore,
    });
  }

  // Sort by score descending (higher score = further left)
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.entry);
}

export function CommunityTierLists({ users, allGames }: CommunityTierListsProps) {
  const [showPredictions, setShowPredictions] = useState(false);
  const [showHotTakes, setShowHotTakes] = useState(false);

  const shadowByUser = useMemo(() => {
    if (!showPredictions || !allGames || allGames.length === 0) return null;

    const map = new Map<string, Map<Tier, ShadowPlacement[]>>();
    for (const user of users) {
      map.set(user.userId, computeShadowRanks(user, users, allGames));
    }
    return map;
  }, [showPredictions, users, allGames]);

  const hotTakes = useMemo(() => {
    if (!showHotTakes) return null;
    return computeHotTakes(users);
  }, [showHotTakes, users]);

  if (users.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No one has created tier lists for this category yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {allGames && allGames.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPredictions((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              showPredictions
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {showPredictions ? "Hide predictions" : "Show predictions"}
          </button>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showHotTakes}
            onChange={(e) => setShowHotTakes(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-red-500 accent-red-500"
          />
          🔥 Hot takes
        </label>
        {showPredictions && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Ghost tiles show predicted placements for unranked games
          </span>
        )}
      </div>

      {users.map((user) => {
        const userShadows = shadowByUser?.get(user.userId);
        const scoreMap = userShadows ? buildScoreMap(user.buckets) : null;
        const tags = topTags(user.buckets, 3);
        const hotTakeId = hotTakes?.get(user.userId) ?? null;
        return (
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
              {tags.length > 0 && (
                <div className="flex gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              {TIERS.map((tier) => {
                const shadows = userShadows?.get(tier) ?? [];
                const entries =
                  scoreMap && shadows.length > 0
                    ? interleaveEntries(user.buckets[tier], shadows, scoreMap)
                    : user.buckets[tier].map((game) => ({ game, shadow: false }));
                return (
                  <ReadOnlyTierRow key={tier} tier={tier} entries={entries} hotTakeId={hotTakeId} />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
