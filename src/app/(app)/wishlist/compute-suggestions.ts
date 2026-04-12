import type { BoardGame } from "@/types/database";
import type { SuggestedGame } from "./wishlist-types";

interface TierPlacement {
  bgg_id: number;
  tier: string;
  score: number | null;
}

const SCORE_THRESHOLD = 7.0;

/**
 * Computes game suggestions based on mechanics/categories overlap
 * with the user's highly-rated games (S and A tier, score >= 7.0).
 */
export function computeSuggestions(
  tierPlacements: TierPlacement[],
  candidateGames: BoardGame[],
  gameMap: Map<number, BoardGame>,
  limit = 12
): SuggestedGame[] {
  if (candidateGames.length === 0) return [];

  // Build preference maps from user's highly-rated games
  const mechanicWeights = new Map<string, number>();
  const categoryWeights = new Map<string, number>();
  let maxWeight = 0;

  const highlyRated = tierPlacements.filter(
    (p) => p.score !== null && p.score >= SCORE_THRESHOLD
  );

  if (highlyRated.length === 0) return [];

  for (const placement of highlyRated) {
    const game = gameMap.get(placement.bgg_id);
    if (!game) continue;
    const weight = placement.score ?? 0;
    for (const m of game.mechanics ?? []) {
      mechanicWeights.set(m, (mechanicWeights.get(m) ?? 0) + weight);
    }
    for (const c of game.categories ?? []) {
      categoryWeights.set(c, (categoryWeights.get(c) ?? 0) + weight);
    }
    maxWeight = Math.max(maxWeight, weight);
  }

  if (maxWeight === 0) return [];

  // Normalize weights to 0-1
  for (const [k, v] of mechanicWeights) {
    mechanicWeights.set(k, v / (maxWeight * highlyRated.length));
  }
  for (const [k, v] of categoryWeights) {
    categoryWeights.set(k, v / (maxWeight * highlyRated.length));
  }

  // Score each candidate
  const scored: SuggestedGame[] = [];
  for (const game of candidateGames) {
    const matchingMechanics: string[] = [];
    const matchingCategories: string[] = [];
    let score = 0;

    for (const m of game.mechanics ?? []) {
      const w = mechanicWeights.get(m);
      if (w) {
        score += w;
        matchingMechanics.push(m);
      }
    }

    for (const c of game.categories ?? []) {
      const w = categoryWeights.get(c);
      if (w) {
        score += w;
        matchingCategories.push(c);
      }
    }

    const totalTags = (game.mechanics?.length ?? 0) + (game.categories?.length ?? 0);
    if (totalTags === 0 || score === 0) continue;

    const normalizedScore = Math.min(score / Math.sqrt(totalTags), 1);

    scored.push({
      game,
      matchScore: Math.round(normalizedScore * 100) / 100,
      matchingMechanics,
      matchingCategories,
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, limit);
}
