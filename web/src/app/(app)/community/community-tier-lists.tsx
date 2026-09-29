import { metric } from "@/lib/api";
import { tierNumber } from "@/lib/metrics";
("use client");

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BoardGame, Tier } from "@/types/database";
import { ReadOnlyTierRow } from "./read-only-tier-row";
import type { TierGameEntry } from "./read-only-tier-row";
import {
  computeShadowRanks,
  buildScoreMap,
  type ShadowPlacement,
} from "./compute-shadow-ranks";
import { RoleBadge } from "@/components/role-badge";
import { TitleDisplay } from "@/components/title-display";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

export interface UserTierData {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  buckets: Record<Tier, BoardGame[]>;
  gamesOwned: number;
  totalGamesRanked: number;
  isAdmin: boolean;
}

interface CommunityTierListsProps {
  users: UserTierData[];
  allGames?: BoardGame[];
}

/** Categories too generic to be interesting as tags. */
const IGNORED_CATEGORIES = new Set(["Party Game", "Card Game"]);

/** Compute top N category tags for a user weighted by their tier scores. */
function topTags(buckets: Record<Tier, BoardGame[]>, n: number): string[] {
  const scoreMap = buildScoreMap(buckets);
  const tagPoints = new Map<string, number>();

  for (const tier of TIERS) {
    for (const game of buckets[tier]) {
      const score = scoreMap.get(game.bgg_id) ?? 0;
      for (const cat of game.categories) {
        if (IGNORED_CATEGORIES.has(cat)) continue;
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
  games: BoardGame[],
): Map<string, number> {
  if (users.length < 2) return new Map();

  const minRaters = 3;

  const scoreMaps = new Map<string, Map<number, number>>();
  for (const user of users) {
    scoreMaps.set(
      user.userId,
      metric() === "difficulty"
        ? new Map(
            TIERS.flatMap((t) =>
              user.buckets[t].map(
                (g) => [g.bgg_id, tierNumber(t)] as [number, number],
              ),
            ),
          )
        : buildScoreMap(user.buckets),
    );
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

  const eligibleIds = games
    .filter(
      (g) =>
        (metric() === "difficulty" ? g.difficulty_votes : (g.rankers ?? 0)) >=
        minRaters,
    )
    .map((g) => g.bgg_id);

  if (eligibleIds.length === 0) return new Map();

  const groupAvg = new Map(
    games
      .filter((g) => eligibleIds.includes(g.bgg_id))
      .map((g) => [
        g.bgg_id,
        metric() === "difficulty" ? g.difficulty! : g.community_score!,
      ]),
  );

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
      if (dev > maxDev || (dev === maxDev && bggId < hotId)) {
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
  const scored: { entry: TierGameEntry; score: number }[] = realGames.map(
    (game) => ({
      entry: { game, shadow: false },
      score: scoreMap.get(game.bgg_id) ?? 0,
    }),
  );

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

export function CommunityTierLists({
  users,
  allGames,
}: CommunityTierListsProps) {
  const [showPredictions, setShowPredictions] = useState(false);

  const shadowByUser = useMemo(() => {
    if (!showPredictions || !allGames || allGames.length === 0) return null;

    const map = new Map<string, Map<Tier, ShadowPlacement[]>>();
    for (const user of users) {
      map.set(user.userId, computeShadowRanks(user, users, allGames));
    }
    return map;
  }, [showPredictions, users, allGames]);

  const hotTakes = useMemo(() => {
    return computeHotTakes(users, allGames ?? []);
  }, [users, allGames]);

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
        {metric() === "enjoyment" && allGames && allGames.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPredictions((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              showPredictions
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
            }`}
          >
            {showPredictions ? "Hide predictions" : "Show predictions"}
          </button>
        )}

        {showPredictions && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Ghost tiles show predicted placements for unranked games
          </span>
        )}
      </div>

      {users.map((user) => {
        const userShadows = shadowByUser?.get(user.userId);
        const scoreMap = userShadows
          ? metric() === "difficulty"
            ? new Map(
                TIERS.flatMap((t) =>
                  user.buckets[t].map(
                    (g) => [g.bgg_id, tierNumber(t)] as [number, number],
                  ),
                ),
              )
            : buildScoreMap(user.buckets)
          : null;
        const tags = topTags(user.buckets, 3);
        const hotTakeId = hotTakes?.get(user.userId) ?? null;
        return (
          <section key={user.userId}>
            <div className="mb-2 flex items-center gap-2">
              <Link
                href={`/users/${user.userId}`}
                className="shrink-0 transition-opacity hover:opacity-80"
              >
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
              <span className="text-sm">
                <Link
                  href={`/users/${user.userId}`}
                  className="font-semibold text-zinc-900 hover:text-cyan-600 dark:text-zinc-50 dark:hover:text-cyan-400"
                >
                  {user.displayName}
                </Link>{" "}
                <TitleDisplay
                  gamesRanked={user.totalGamesRanked}
                  gamesOwned={user.gamesOwned}
                />
              </span>
              <RoleBadge role={user.isAdmin ? "admin" : null} />
              {tags.length > 0 && (
                <div className="flex gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-white/5 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {TIERS.every((t) => user.buckets[t].length === 0) && (
              <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
                No {metric()} rankings yet.
              </p>
            )}
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
              {TIERS.map((tier) => {
                const shadows = userShadows?.get(tier) ?? [];
                const entries =
                  scoreMap && shadows.length > 0
                    ? interleaveEntries(user.buckets[tier], shadows, scoreMap)
                    : user.buckets[tier].map((game) => ({
                        game,
                        shadow: false,
                      }));
                return (
                  <ReadOnlyTierRow
                    key={tier}
                    tier={tier}
                    entries={entries}
                    hotTakeId={hotTakeId}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
