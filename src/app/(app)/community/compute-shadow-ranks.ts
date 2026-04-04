import type { BoardGame, Tier } from "@/types/database";
import { computeScores } from "../tier-list/compute-scores";
import type { UserTierData } from "./community-tier-lists";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];
const MIN_SHARED = 3;
const MIN_RATERS = 2;
const DISTANCE_SMOOTHING = 0.1;
/** How much the user's personal average pulls the prediction (0 = pure group, 1 = pure personal). */
const PERSONAL_BLEND = 0.35;

export interface ShadowPlacement {
  game: BoardGame;
  tier: Tier;
  predictedScore: number;
}

/** Map a predicted 1–10 score to a tier using fixed boundaries. */
function scoreToTier(score: number): Tier {
  if (score >= 8.5) return "S";
  if (score >= 7.0) return "A";
  if (score >= 5.5) return "B";
  if (score >= 4.0) return "C";
  if (score >= 2.5) return "D";
  return "F";
}

/** Get the flat ordered list of bgg_ids from tier buckets (S→F). */
export function flatOrder(buckets: Record<Tier, BoardGame[]>): number[] {
  return TIERS.flatMap((tier) => buckets[tier].map((g) => g.bgg_id));
}

/** Build a score map (bggId → 10-to-1 score) for a user's flat ranking. */
export function buildScoreMap(buckets: Record<Tier, BoardGame[]>): Map<number, number> {
  const order = flatOrder(buckets);
  const scores = computeScores(order.length);
  const map = new Map<number, number>();
  for (let i = 0; i < order.length; i++) {
    map.set(order[i], scores[i]);
  }
  return map;
}

/**
 * Compute the alignment distance between two users on their shared games.
 * Reranks both users on only the shared subset for fair comparison.
 * Returns null if fewer than MIN_SHARED games overlap.
 */
function pairwiseDistance(
  userOrder: number[],
  otherOrder: number[],
  userSet: Set<number>,
  otherSet: Set<number>,
): number | null {
  const shared: number[] = [];
  for (const id of userSet) {
    if (otherSet.has(id)) shared.push(id);
  }
  if (shared.length < MIN_SHARED) return null;

  const sharedSet = new Set(shared);
  const userFiltered = userOrder.filter((id) => sharedSet.has(id));
  const otherFiltered = otherOrder.filter((id) => sharedSet.has(id));

  const userScores = computeScores(userFiltered.length);
  const otherScores = computeScores(otherFiltered.length);

  const userMap = new Map<number, number>();
  for (let i = 0; i < userFiltered.length; i++) {
    userMap.set(userFiltered[i], userScores[i]);
  }
  const otherMap = new Map<number, number>();
  for (let i = 0; i < otherFiltered.length; i++) {
    otherMap.set(otherFiltered[i], otherScores[i]);
  }

  let totalDiff = 0;
  for (const [bggId, score] of userMap) {
    totalDiff += Math.abs(score - otherMap.get(bggId)!);
  }

  return totalDiff / shared.length;
}

/**
 * Compute predicted tier placements for games a user hasn't ranked,
 * using inverse-distance weighted collaborative filtering.
 *
 * @param targetUser - The user to generate predictions for
 * @param allUsers - All users with tier data (including targetUser)
 * @param allGames - Full game catalog for the current category
 * @returns Map of tier → shadow placements, sorted by predicted score desc
 */
export function computeShadowRanks(
  targetUser: UserTierData,
  allUsers: UserTierData[],
  allGames: BoardGame[],
): Map<Tier, ShadowPlacement[]> {
  const result = new Map<Tier, ShadowPlacement[]>();
  for (const tier of TIERS) {
    result.set(tier, []);
  }

  const targetOrder = flatOrder(targetUser.buckets);
  const targetSet = new Set(targetOrder);
  const targetScoreMap = buildScoreMap(targetUser.buckets);

  // User's personal average score (their center of gravity)
  let targetAvg = 5.5;
  if (targetScoreMap.size > 0) {
    let sum = 0;
    for (const score of targetScoreMap.values()) sum += score;
    targetAvg = sum / targetScoreMap.size;
  }

  // Games the target user hasn't ranked
  const unrankedGames = allGames.filter((g) => !targetSet.has(g.bgg_id));
  if (unrankedGames.length === 0) return result;

  // Compute distances + score maps for all other users
  const others: { scoreMap: Map<number, number>; distance: number }[] = [];

  for (const other of allUsers) {
    if (other.userId === targetUser.userId) continue;

    const otherOrder = flatOrder(other.buckets);
    const otherSet = new Set(otherOrder);

    const dist = pairwiseDistance(targetOrder, otherOrder, targetSet, otherSet);
    if (dist === null) continue;

    others.push({
      scoreMap: buildScoreMap(other.buckets),
      distance: dist,
    });
  }

  if (others.length < MIN_RATERS) return result;

  // Predict each unranked game
  for (const game of unrankedGames) {
    let weightedSum = 0;
    let weightTotal = 0;
    let raterCount = 0;

    for (const { scoreMap, distance } of others) {
      const score = scoreMap.get(game.bgg_id);
      if (score === undefined) continue;

      const weight = 1 / (distance + DISTANCE_SMOOTHING);
      weightedSum += score * weight;
      weightTotal += weight;
      raterCount++;
    }

    if (raterCount < MIN_RATERS) continue;

    const groupScore = weightedSum / weightTotal;
    // Blend group prediction with user's personal average
    const blended = groupScore * (1 - PERSONAL_BLEND) + targetAvg * PERSONAL_BLEND;
    const predictedScore = Math.round(Math.min(10, Math.max(1, blended)) * 10) / 10;
    const tier = scoreToTier(predictedScore);

    result.get(tier)!.push({ game, tier, predictedScore });
  }

  // Sort each tier by predicted score descending
  for (const tier of TIERS) {
    result.get(tier)!.sort((a, b) => b.predictedScore - a.predictedScore);
  }

  return result;
}
