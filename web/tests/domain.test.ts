import { describe, expect, test } from "bun:test";
import { historySegments } from "../src/lib/history";
import { householdIds } from "../src/lib/household";
import { calculateWeights } from "../src/lib/picker-utils";
import { buildUserTierData } from "../src/app/(app)/community/build-user-tier-data";
import type { BoardGame } from "../src/types/database";
const game = (id: number) =>
  ({ bgg_id: id, name: `Game ${id}`, categories: [] }) as BoardGame;
describe("daily history", () => {
  test("decreases retain a negative daily change and carry native quiet days", () => {
    const result = historySegments(
      [
        { snapshotAt: "2026-09-01", score: 9 },
        { snapshotAt: "2026-09-04", score: 3 },
      ],
      "2026-09-07",
    );
    expect(result).toHaveLength(1);
    expect(result[0].map((p) => p.score)).toEqual([9, 3, 3]);
    expect(result[0][1].change).toBe(-6);
    expect(result[0][2].carried).toBe(true);
  });
  test("unranked days break history instead of creating a zero score", () => {
    const result = historySegments(
      [
        { snapshotAt: "2026-09-01", score: 9 },
        { snapshotAt: "2026-09-02", score: null },
        { snapshotAt: "2026-09-04", score: 2 },
      ],
      "2026-09-04",
    );
    expect(result).toHaveLength(2);
    expect(result[1][0].change).toBeNull();
    expect(result.flat().map((p) => p.score)).toEqual([9, 2]);
  });
  test("legacy observations do not fill unknown gaps or extend to today", () => {
    const result = historySegments(
      [
        { snapshotAt: "2026-09-01", score: 9, imported: true },
        { snapshotAt: "2026-09-04", score: 2, imported: true },
      ],
      "2026-09-29",
    );
    expect(result).toHaveLength(2);
    expect(result.flat()).toHaveLength(2);
    expect(result[1][0].change).toBeNull();
  });
  test("one closing value per date and no history truncation", () => {
    const rows = Array.from({ length: 900 }, (_, i) => ({
      snapshotAt: new Date(Date.UTC(2020, 0, i + 1)).toISOString(),
      score: 5,
    }));
    rows.push({ ...rows[0], score: 2 });
    const result = historySegments(rows, rows[899].snapshotAt.slice(0, 10));
    expect(result.flat()).toHaveLength(900);
    expect(result[0][0].score).toBe(2);
  });
});
test("households resolve asymmetric and connected partner links", () => {
  const profiles = [
    { id: "a" },
    { id: "b", partner_id: "a" },
    { id: "c", partner_id: "b" },
    { id: "d" },
  ];
  expect(householdIds(profiles, "a").sort()).toEqual(["a", "b", "c"]);
  expect(householdIds(profiles, "d")).toEqual(["d"]);
});
test("picker weights never use absent players when no one attends", () => {
  expect(
    calculateWeights(
      [game(1), game(2)],
      "player-ranked",
      { absent: { "1": 10, "2": 1 } },
      [],
    ),
  ).toEqual([5, 5]);
  expect(
    calculateWeights(
      [game(1), game(2)],
      "player-ranked",
      { a: { "1": 2, "2": 8 }, absent: { "1": 10, "2": 1 } },
      ["a"],
    ),
  ).toEqual([2, 8]);
});
test("difficulty-only players keep level zero and empty players remain visible", () => {
  const profiles = new Map([
    ["a", { display_name: "Zeta", avatar_url: null }],
    ["b", { display_name: "Alpha", avatar_url: null }],
    ["c", { display_name: "Third", avatar_url: null }],
  ]);
  const ranks = [
    { user_id: "a", bgg_id: 1, tier: "S" as const, position: 0 },
    { user_id: "b", bgg_id: 1, tier: "S" as const, position: 0 },
  ];
  const rows = buildUserTierData(
    ranks,
    new Map([[1, game(1)]]),
    profiles,
    new Map(),
    new Map([
      ["a", 20],
      ["c", 10],
    ]),
    true,
  );
  expect(rows.map((r) => r.userId)).toEqual(["a", "c", "b"]);
  expect(rows[2].totalGamesRanked).toBe(0);
  expect(rows[1].buckets.S).toEqual([]);
});
