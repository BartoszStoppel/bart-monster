import type { BoardGame } from "@/types/database";

export type PickerMode = "random" | "complexity" | "player-ranked";

/**
 * Calculate probability weights for each game based on the selected mode.
 *
 * For "complexity": `complexityBias` runs 0–100. 50 is neutral (equal weights);
 * below 50 favors lighter games, above 50 favors heavier ones, and the bias
 * strengthens the further the slider moves from center.
 *
 * For "player-ranked": uses the selected players' tier scores.
 * If a player hasn't scored a game, their personal average score is used
 * as a stand-in so unranked games get a middle-of-the-road probability.
 */
export function calculateWeights(
  games: BoardGame[],
  mode: PickerMode,
  userScoreMap: Record<string, Record<string, number>>,
  selectedPlayerIds: string[],
  complexityBias = 50
): number[] {
  if (games.length === 0) return [];

  switch (mode) {
    case "random":
      return games.map(() => 1);

    case "complexity": {
      const weights = games.map((g) => g.bgg_weight ?? 2.5);
      const minW = Math.min(...weights);
      const maxW = Math.max(...weights);
      // -1 (full easy) .. 0 (neutral) .. +1 (full hard)
      const bias = (complexityBias - 50) / 50;
      if (bias === 0 || maxW === minW) return games.map(() => 1);
      const STRENGTH = 2.5; // max ln-weight spread at the slider extremes
      return weights.map((w) => {
        // c: -1 for the lightest game in the pool, +1 for the heaviest
        const c = (2 * (w - minW)) / (maxW - minW) - 1;
        return Math.exp(bias * c * STRENGTH);
      });
    }

    case "player-ranked": {
      const playerIds =
        selectedPlayerIds.length > 0 ? selectedPlayerIds : Object.keys(userScoreMap);

      if (playerIds.length === 0) return games.map(() => 5);

      // Precompute each player's average score across all their rated games
      const playerAvgs = new Map<string, number>();
      for (const pid of playerIds) {
        const scores = userScoreMap[pid];
        if (!scores) {
          playerAvgs.set(pid, 5.5);
          continue;
        }
        const vals = Object.values(scores);
        if (vals.length === 0) {
          playerAvgs.set(pid, 5.5);
          continue;
        }
        playerAvgs.set(pid, vals.reduce((a, b) => a + b, 0) / vals.length);
      }

      return games.map((g) => {
        const bggKey = String(g.bgg_id);
        let total = 0;
        for (const pid of playerIds) {
          const scores = userScoreMap[pid];
          const score = scores?.[bggKey];
          total += score ?? playerAvgs.get(pid)!;
        }
        return total / playerIds.length;
      });
    }
  }
}

/**
 * Pick a random index using weighted probabilities.
 */
export function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
