import { expect, test } from "bun:test";
import { calculateWeights } from "../src/lib/picker-utils";
import type { BoardGame } from "../src/types/database";

const games = [
  { bgg_id: 1, difficulty: 1, bgg_weight: 5 },
  { bgg_id: 2, difficulty: 3.5, bgg_weight: 3 },
  { bgg_id: 3, difficulty: 6, bgg_weight: 1 },
  { bgg_id: 4, difficulty: null, bgg_weight: 4 },
] as BoardGame[];

test("restored complexity slider follows community difficulty in both directions", () => {
  const easy = calculateWeights(games, "complexity", {}, [], 0);
  const hard = calculateWeights(games, "complexity", {}, [], 100);
  expect(easy[0]).toBeGreaterThan(easy[1]);
  expect(easy[1]).toBeGreaterThan(easy[2]);
  expect(hard[2]).toBeGreaterThan(hard[1]);
  expect(hard[1]).toBeGreaterThan(hard[0]);
  expect(easy[3]).toBe(0);
  expect(hard[3]).toBe(0);
  expect(calculateWeights(games, "complexity", {}, [], 50)).toEqual([1, 1, 1, 1]);
});

test("complexity slider handles tied and absent community scores", () => {
  expect(calculateWeights([games[0], games[0]], "complexity", {}, [], 100)).toEqual([1, 1]);
  expect(calculateWeights([games[3]], "complexity", {}, [], 0)).toEqual([0]);
  expect(calculateWeights([], "complexity", {}, [], 100)).toEqual([]);
});
