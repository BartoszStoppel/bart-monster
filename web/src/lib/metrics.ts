import { metric } from "./api";
import type { Tier } from "@/types/database";
export const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];
export const DIFFICULTY_LABELS: Record<Tier, string> = {
  S: "Monstrous",
  A: "Brutal",
  B: "Demanding",
  C: "Challenging",
  D: "Tame",
  F: "Cuddly",
};
export function tierLabel(tier: string) {
  return metric() === "difficulty"
    ? (DIFFICULTY_LABELS[tier as Tier] ?? tier)
    : tier;
}
export function tierNumber(tier: string) {
  return 6 - TIERS.indexOf(tier as Tier);
}
export function difficultyTier(tier: string | number): Tier {
  return TIERS[6 - Number(tier)] ?? (tier as Tier);
}
export function scoreMax() {
  return metric() === "difficulty" ? 6 : 10;
}
