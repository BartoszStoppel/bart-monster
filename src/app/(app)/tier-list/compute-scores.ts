import type { BoardGame, Tier } from "@/types/database";
import type { TierEntry } from "./use-tier-save";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

/**
 * Extract a flat ranking from tier entries: S left-to-right, then A, ..., F.
 * Returns games in order from best (index 0) to worst.
 */
export function flatRanking(tiers: TierEntry[]): BoardGame[] {
  const tierMap = new Map(tiers.map((t) => [t.tier, t.games]));
  return TIERS.flatMap((tier) => tierMap.get(tier) ?? []);
}

/**
 * Compute evenly-spaced scores from 10 (best) to 1 (worst).
 *
 * Each game gets a unique decimal score, rounded to one decimal place.
 * For N games, the step between adjacent games is 9 / (N - 1).
 * A single game receives a score of 10.
 *
 * Examples:
 * - 1 game  → [10.0]
 * - 2 games → [10.0, 1.0]
 * - 3 games → [10.0, 5.5, 1.0]
 * - 5 games → [10.0, 7.8, 5.5, 3.2, 1.0]
 */
export function computeScores(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [10];

  const step = 9 / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    Math.round((10 - i * step) * 10) / 10
  );
}
