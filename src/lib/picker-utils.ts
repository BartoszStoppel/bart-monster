import type { BoardGame } from "@/types/database";

export type PickerMode = "random" | "favor-easy" | "favor-hard" | "player-ranked";

/**
 * Calculate probability weights for each game based on the selected mode.
 *
 * For "player-ranked": uses the selected players' tier scores.
 * If a player hasn't scored a game, their personal average score is used
 * as a stand-in so unranked games get a middle-of-the-road probability.
 */
export function calculateWeights(
  games: BoardGame[],
  mode: PickerMode,
  userScoreMap: Record<string, Record<string, number>>,
  selectedPlayerIds: string[]
): number[] {
  if (games.length === 0) return [];

  switch (mode) {
    case "random":
      return games.map(() => 1);

    case "favor-easy": {
      const weights = games.map((g) => g.bgg_weight ?? 2.5);
      const maxW = Math.max(...weights);
      return weights.map((w) => maxW - w + 0.5);
    }

    case "favor-hard": {
      return games.map((g) => g.bgg_weight ?? 2.5);
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
