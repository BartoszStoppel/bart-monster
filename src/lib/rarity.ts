// Loot-rarity derived from the group's "Ours" score (falls back to BGG rating).
// Ties the monster-card rarity header into the same gradient as the rank ladder.
export type Rarity = "Legendary" | "Epic" | "Rare" | "Uncommon" | "Common";

export function getRarity(
  oursScore: number | null | undefined,
  bggRating: number | null | undefined
): Rarity | null {
  const s = oursScore ?? bggRating ?? null;
  if (s == null) return null;
  if (s >= 9) return "Legendary";
  if (s >= 8) return "Epic";
  if (s >= 7) return "Rare";
  if (s >= 6) return "Uncommon";
  return "Common";
}

// Badge styling per rarity band (on a surface-container-highest plate).
export const RARITY_BADGE: Record<Rarity, string> = {
  Legendary: "border-amber-600/70 text-amber-300",
  Epic: "border-violet-700/70 text-violet-300",
  Rare: "border-sky-700/70 text-sky-300",
  Uncommon: "border-lime-700/70 text-lime-300",
  Common: "border-outline-variant text-on-surface-variant",
};
