// A board game is a monster; this is its level (1–10) — how formidable it is.
// Blends the group's "Ours" rating, BGG rating, complexity (weight), play time,
// minimum age, and player count. Each factor is normalised to 0–1 and weighted;
// only factors that have data count toward the score (re-normalised by the
// weights present), so a sparsely-populated game still gets a fair level.
import type { BoardGame, SuggestedPlayerCount } from "@/types/database";

type LevelInputs = Pick<
  BoardGame,
  "bgg_rating" | "bgg_weight" | "playing_time" | "min_age" | "suggested_players"
>;

// The player count BGG's community voted "best" most often (e.g. "8+" → 8).
// Returns null if there's no poll data, so the factor is simply skipped.
function bestPlayerCount(suggested: SuggestedPlayerCount[] | null | undefined): number | null {
  let bestNum: number | null = null;
  let bestVotes = 0;
  for (const s of suggested ?? []) {
    if (s.best > bestVotes) {
      bestVotes = s.best;
      const n = parseInt(s.numPlayers, 10);
      if (Number.isFinite(n)) bestNum = n;
    }
  }
  return bestNum;
}

// Normalise a value to 0–1 over its *realistic* range (not its absolute max) —
// real games never hit the bottom of the absolute scales, so without this the
// lightest games still land around level 5. With it, the full 1–10 is used.
function norm(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function getMonsterLevel(
  oursScore: number | null | undefined,
  game: LevelInputs
): number | null {
  const factors: Array<[norm: number, weight: number]> = [];
  const push = (n: number | null, weight: number) => {
    if (n != null && Number.isFinite(n)) factors.push([n, weight]);
  };

  push(oursScore != null ? norm(oursScore, 4, 9.5) : null, 3); // group rating dominates
  push(game.bgg_rating != null ? norm(Number(game.bgg_rating), 5, 8.5) : null, 2);
  push(game.bgg_weight != null ? norm(Number(game.bgg_weight), 1, 4.5) : null, 2.5); // complexity
  push(game.playing_time != null ? norm(game.playing_time, 20, 150) : null, 1.5); // time
  push(game.min_age != null ? norm(game.min_age, 6, 16) : null, 1);
  const players = bestPlayerCount(game.suggested_players);
  push(players != null ? norm(players, 2, 7) : null, 1);

  if (factors.length === 0) return null;
  const totalWeight = factors.reduce((a, [, w]) => a + w, 0);
  const score = factors.reduce((a, [v, w]) => a + v * w, 0) / totalWeight;
  return Math.max(1, Math.min(10, Math.round(score * 10)));
}

// Badge styling per level band — hotter = more formidable (loot-rarity gradient,
// matching the rank ladder): stone → slime → arcane-blue → violet → torch-amber.
export function levelBadgeClass(level: number): string {
  if (level >= 9) return "border-amber-600/70 text-amber-300";
  if (level >= 8) return "border-violet-700/70 text-violet-300";
  if (level >= 7) return "border-sky-700/70 text-sky-300";
  if (level >= 6) return "border-lime-700/70 text-lime-300";
  return "border-outline-variant text-on-surface-variant";
}
