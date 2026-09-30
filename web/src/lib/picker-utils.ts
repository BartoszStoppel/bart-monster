import type { BoardGame } from "@/types/database";

export type PickerMode = "random" | "complexity" | "player-ranked";

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
  selectedPlayerIds: string[],
  complexityBias = 50,
): number[] {
  if (games.length === 0) return [];

  switch (mode) {
    case "random":
      return games.map(() => 1);

    case "complexity": {
      const bias = Math.max(-1, Math.min(1, (complexityBias - 50) / 50));
      if (bias === 0) return games.map(() => 1);
      const known = games.flatMap((game) =>
        game.difficulty == null ? [] : [game.difficulty],
      );
      if (known.length === 0) return games.map(() => 0);
      const min = Math.min(...known);
      const max = Math.max(...known);
      return games.map((game) => {
        if (game.difficulty == null) return 0;
        if (min === max) return 1;
        const relative = (2 * (game.difficulty - min)) / (max - min) - 1;
        return Math.exp(bias * relative * 2.5);
      });
    }

    case "player-ranked": {
      const playerIds = selectedPlayerIds;

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
