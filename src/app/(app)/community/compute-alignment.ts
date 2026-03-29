import type { BoardGame, Tier } from "@/types/database";
import { computeScores } from "../tier-list/compute-scores";
import type { UserTierData } from "./community-tier-lists";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

export interface AlignmentEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** Mean absolute score difference — lower = more aligned */
  distance: number;
}

export interface UserAlignment {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  allies: AlignmentEntry[];
  rivals: AlignmentEntry[];
}

/**
 * Get the flat ordered list of bgg_ids from a user's tier buckets,
 * preserving tier order (S → F) and position within each tier.
 */
function flatOrder(buckets: Record<Tier, BoardGame[]>): number[] {
  return TIERS.flatMap((tier) => buckets[tier].map((g) => g.bgg_id));
}

/** Penalty distance for games the other user hasn't played. */
const UNPLAYED_PENALTY = 2;

const MIN_SHARED = 3;

/**
 * Compute alignment between all users.
 *
 * For each row user, their full tier-list scores (10→1 across all their games)
 * are the baseline. For each other user, shared games are reranked (10→1 across
 * only the shared subset) to remove list-size skew on the *other* user's side.
 * Games the other user hasn't played receive a fixed penalty distance (4.5).
 * The final distance averages across ALL of the row user's games, so low
 * overlap naturally pushes the distance up.
 */
export function computeAlignments(users: UserTierData[]): UserAlignment[] {
  const orderMap = new Map<string, number[]>();
  const idSets = new Map<string, Set<number>>();

  for (const user of users) {
    const order = flatOrder(user.buckets);
    orderMap.set(user.userId, order);
    idSets.set(user.userId, new Set(order));
  }

  const results: UserAlignment[] = [];

  for (const user of users) {
    const userOrder = orderMap.get(user.userId)!;
    const userIds = idSets.get(user.userId)!;
    const comparisons: AlignmentEntry[] = [];

    for (const other of users) {
      if (other.userId === user.userId) continue;
      const otherIds = idSets.get(other.userId)!;

      const shared = new Set<number>();
      for (const id of userIds) {
        if (otherIds.has(id)) shared.add(id);
      }

      if (shared.size < MIN_SHARED) continue;

      // Rerank other user on only the shared games
      const otherOrder = orderMap.get(other.userId)!;
      const sharedFiltered = otherOrder.filter((id) => shared.has(id));
      const otherSharedScores = computeScores(sharedFiltered.length);
      const otherScoreMap = new Map<number, number>();
      for (let i = 0; i < sharedFiltered.length; i++) {
        otherScoreMap.set(sharedFiltered[i], otherSharedScores[i]);
      }

      // Rerank row user on only the shared games too, for fair comparison
      const userFiltered = userOrder.filter((id) => shared.has(id));
      const userSharedScores = computeScores(userFiltered.length);
      const userSharedMap = new Map<number, number>();
      for (let i = 0; i < userFiltered.length; i++) {
        userSharedMap.set(userFiltered[i], userSharedScores[i]);
      }

      // Sum diffs for shared games (reranked) + penalty for unplayed
      let totalDiff = 0;
      for (const [bggId, score] of userSharedMap) {
        totalDiff += Math.abs(score - otherScoreMap.get(bggId)!);
      }
      const unplayedCount = userIds.size - shared.size;
      totalDiff += unplayedCount * UNPLAYED_PENALTY;

      comparisons.push({
        userId: other.userId,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
        distance: Math.round((totalDiff / userIds.size) * 100) / 100,
      });
    }

    comparisons.sort((a, b) => a.distance - b.distance);

    results.push({
      userId: user.userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      allies: comparisons.slice(0, 3),
      rivals: comparisons.slice(-3).reverse(),
    });
  }

  return results;
}
