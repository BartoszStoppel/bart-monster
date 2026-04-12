import type { BoardGame, Tier, TierPlacement } from "@/types/database";
import type { UserTierData } from "./community-tier-lists";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

/**
 * Group tier placements by user and build structured tier data
 * for rendering tier lists and computing alignments.
 */
export function buildUserTierData(
  placements: Pick<TierPlacement, "bgg_id" | "tier" | "position" | "user_id">[],
  gameMap: Map<number, BoardGame>,
  profileMap: Map<string, { display_name: string; avatar_url: string | null; is_admin?: boolean }>,
  ownershipCounts: Map<string, number>,
  totalPlacementCounts?: Map<string, number>,
): UserTierData[] {
  const byUser = new Map<
    string,
    Pick<TierPlacement, "bgg_id" | "tier" | "position">[]
  >();

  for (const p of placements) {
    if (!gameMap.has(p.bgg_id)) continue;
    let list = byUser.get(p.user_id);
    if (!list) {
      list = [];
      byUser.set(p.user_id, list);
    }
    list.push(p);
  }

  const result: UserTierData[] = [];

  for (const [userId, userPlacements] of byUser) {
    const profile = profileMap.get(userId);
    if (!profile) continue;

    const buckets: Record<Tier, BoardGame[]> = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
      F: [],
    };

    for (const tier of TIERS) {
      const tierPlacements = userPlacements
        .filter((p) => p.tier === tier)
        .sort((a, b) => a.position - b.position);
      for (const p of tierPlacements) {
        const game = gameMap.get(p.bgg_id);
        if (game) buckets[tier].push(game);
      }
    }

    const totalRanked = TIERS.reduce(
      (sum, tier) => sum + buckets[tier].length,
      0
    );
    if (totalRanked === 0) continue;

    result.push({
      userId,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      buckets,
      gamesOwned: ownershipCounts.get(userId) ?? 0,
      totalGamesRanked: totalPlacementCounts?.get(userId) ?? totalRanked,
      isAdmin: profile.is_admin ?? false,
    });
  }

  result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return result;
}
