"use client";

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
      <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
        <span className="material-symbols-outlined text-[40px] text-outline">format_list_numbered</span>
        <p className="text-on-surface-variant">
          No one has created tier lists for this category yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {allGames && allGames.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPredictions((v) => !v)}
            className={`rune-chip flex items-center gap-1.5 rounded-full px-4 py-1.5 font-stat text-stat-label ${
              showPredictions ? "active" : "text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            {showPredictions ? "Hide predictions" : "Show predictions"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowHotTakes((v) => !v)}
          className={`rune-chip flex items-center gap-1.5 rounded-full px-4 py-1.5 font-stat text-stat-label ${
            showHotTakes ? "active" : "text-on-surface-variant"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
          {showHotTakes ? "Hide hot takes" : "Show hot takes"}
        </button>
        {showPredictions && (
          <span className="text-xs text-on-surface-variant">
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
          <section key={user.userId} className="monster-card flex flex-col gap-2 rounded-lg p-card-padding">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/users/${user.userId}`} className="shrink-0 transition-opacity hover:opacity-80">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-highest text-xs font-medium text-on-surface-variant">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
              <span className="text-sm">
                <Link href={`/users/${user.userId}`} className="font-semibold text-on-surface hover:text-primary">{user.displayName}</Link>{" "}
                <TitleDisplay gamesRanked={user.totalGamesRanked} gamesOwned={user.gamesOwned} />
              </span>
              <RoleBadge role={user.isAdmin ? "admin" : null} />
              {tags.length > 0 && (
                <div className="flex gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rune-chip rounded-full px-2 py-0.5 text-[10px] font-medium text-on-surface-variant"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-outline-variant">
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
