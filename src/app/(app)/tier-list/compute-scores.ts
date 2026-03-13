import type { BoardGame, Tier } from "@/types/database";
import type { TierEntry } from "./use-tier-save";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

/** Fill order: middle scores first (5, 6, 4, 7, 3, 8, 2, 9, 1, 10). */
const FILL_ORDER = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0];

/**
 * Extract a flat ranking from tier entries: S left-to-right, then A, ..., F.
 * Returns games in order from best (index 0) to worst.
 */
export function flatRanking(tiers: TierEntry[]): BoardGame[] {
  const tierMap = new Map(tiers.map((t) => [t.tier, t.games]));
  return TIERS.flatMap((tier) => tierMap.get(tier) ?? []);
}

/**
 * Compute normalized 1–10 scores for N ranked games.
 *
 * Divides N games into 10 score buckets as evenly as possible.
 * Extra slots go to middle scores first (5, 6, 4, 7, …).
 *
 * Examples:
 * - 10 games → [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
 * - 11 games → [10, 9, 8, 7, 6, 5, 5, 4, 3, 2, 1]
 * - 20 games → [10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1]
 */
export function computeScores(count: number): number[] {
  const base = Math.floor(count / 10);
  const remainder = count % 10;

  const bucketSizes = new Array<number>(10).fill(base);
  for (let i = 0; i < remainder; i++) {
    bucketSizes[FILL_ORDER[i]]++;
  }

  const scores: number[] = [];
  for (let b = 0; b < 10; b++) {
    const score = 10 - b;
    for (let j = 0; j < bucketSizes[b]; j++) {
      scores.push(score);
    }
  }

  return scores;
}

export const MIN_RANKED_GAMES = 10;
