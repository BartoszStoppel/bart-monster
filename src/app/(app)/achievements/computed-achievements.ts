import { SupabaseClient } from "@supabase/supabase-js";

export interface AchievementHolder {
  display_name: string;
  avatar_url: string | null;
  detail: string | null;
  category_label: string | null;
}

export interface AchievementDisplay {
  title: string;
  description: string;
  icon: string;
  holders: AchievementHolder[];
  ranked?: boolean;
}

interface ProfileEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

type ProfileMap = Map<string, ProfileEntry>;

const MIN_RATERS = 3;

interface GameInfo {
  name: string;
  thumbnail_url: string | null;
  bgg_rating: number | null;
  category: "party" | "board";
}

interface GameStats {
  bggId: number;
  avg: number;
  stdDev: number;
  count: number;
}

function gameHolder(
  game: GameInfo | undefined,
  detail: string
): AchievementHolder {
  return {
    display_name: game?.name ?? "Unknown Game",
    avatar_url: game?.thumbnail_url ?? null,
    detail,
    category_label: game?.category === "party" ? "Party:" : "Board:",
  };
}

/** Return [board winner, party winner] holders for an achievement. */
function categoryWinners(
  sorted: GameStats[],
  gameMap: Map<number, GameInfo>,
  detailFn: (gs: GameStats) => string
): AchievementHolder[] {
  let boardHolder: AchievementHolder | null = null;
  let partyHolder: AchievementHolder | null = null;

  for (const gs of sorted) {
    const game = gameMap.get(gs.bggId);
    if (!game) continue;
    if (game.category === "board" && !boardHolder) {
      boardHolder = gameHolder(game, detailFn(gs));
    } else if (game.category === "party" && !partyHolder) {
      partyHolder = gameHolder(game, detailFn(gs));
    }
    if (boardHolder && partyHolder) break;
  }

  const holders: AchievementHolder[] = [];
  if (boardHolder) holders.push(boardHolder);
  if (partyHolder) holders.push(partyHolder);
  return holders;
}

export async function computeCollectorAchievement(
  supabase: SupabaseClient,
  profileMap: ProfileMap
): Promise<AchievementDisplay> {
  const { data: ownership } = await supabase
    .from("user_game_collection")
    .select("user_id, owned");

  const countByUser = new Map<string, number>();
  for (const row of ownership ?? []) {
    if (!row.owned) continue;
    countByUser.set(row.user_id, (countByUser.get(row.user_id) ?? 0) + 1);
  }

  const topCollectors = [...countByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return {
    title: "Board Game Collector",
    description: "Own the most board games in the group",
    icon: "🏆",
    ranked: true,
    holders: topCollectors.map(([userId, count]) => {
      const profile = profileMap.get(userId);
      return {
        display_name: profile?.display_name ?? "Unknown",
        avatar_url: profile?.avatar_url ?? null,
        detail: `${count} ${count === 1 ? "game" : "games"}`,
        category_label: null,
      };
    }),
  };
}

export async function computeGameAchievements(
  supabase: SupabaseClient
): Promise<AchievementDisplay[]> {
  const [placementsRes, gamesRes, collectionRes] = await Promise.all([
    supabase.from("tier_placements").select("bgg_id, score"),
    supabase
      .from("board_games")
      .select("bgg_id, name, thumbnail_url, bgg_rating, category"),
    supabase.from("user_game_collection").select("bgg_id, owned, wishlist"),
  ]);

  const gameMap = new Map<number, GameInfo>(
    (gamesRes.data ?? []).map((g) => [g.bgg_id, g])
  );

  // --- Score-based stats ---
  const scoresByGame = new Map<number, number[]>();
  for (const p of placementsRes.data ?? []) {
    if (p.score == null) continue;
    const arr = scoresByGame.get(p.bgg_id) ?? [];
    arr.push(p.score);
    scoresByGame.set(p.bgg_id, arr);
  }

  const gameStats: GameStats[] = [];
  for (const [bggId, scores] of scoresByGame) {
    if (scores.length < MIN_RATERS) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length;
    gameStats.push({
      bggId,
      avg,
      stdDev: Math.sqrt(variance),
      count: scores.length,
    });
  }

  const achievements: AchievementDisplay[] = [];

  // --- Score-based achievements ---
  if (gameStats.length > 0) {
    const byControversy = [...gameStats].sort(
      (a, b) => b.stdDev - a.stdDev
    );
    const controversyHolders = categoryWinners(
      byControversy,
      gameMap,
      (gs) =>
        `spread: ${gs.stdDev.toFixed(1)} across ${gs.count} ratings`
    );
    if (controversyHolders.length > 0) {
      achievements.push({
        title: "Most Controversial",
        description: "The game with the widest spread of opinions",
        icon: "🔥",
        holders: controversyHolders,
      });
    }

    const byLiked = [...gameStats].sort((a, b) => b.avg - a.avg);
    const likedHolders = categoryWinners(
      byLiked,
      gameMap,
      (gs) => `avg: ${gs.avg.toFixed(1)} across ${gs.count} ratings`
    );
    if (likedHolders.length > 0) {
      achievements.push({
        title: "Most Liked",
        description: "Highest average tier score in the group",
        icon: "❤️",
        holders: likedHolders,
      });
    }

    const byHated = [...gameStats].sort((a, b) => a.avg - b.avg);
    const hatedHolders = categoryWinners(
      byHated,
      gameMap,
      (gs) => `avg: ${gs.avg.toFixed(1)} across ${gs.count} ratings`
    );
    if (hatedHolders.length > 0) {
      achievements.push({
        title: "Most Hated",
        description: "Lowest average tier score in the group",
        icon: "💀",
        holders: hatedHolders,
      });
    }

    const byConsensus = [...gameStats].sort((a, b) => a.stdDev - b.stdDev);
    const consensusHolders = categoryWinners(
      byConsensus,
      gameMap,
      (gs) =>
        `spread: ${gs.stdDev.toFixed(1)} across ${gs.count} ratings`
    );
    if (consensusHolders.length > 0) {
      achievements.push({
        title: "Consensus Pick",
        description: "The game everyone agrees on",
        icon: "🤝",
        holders: consensusHolders,
      });
    }
  }

  // --- BGG comparison achievements ---
  const bggComparisons = gameStats
    .map((gs) => {
      const game = gameMap.get(gs.bggId);
      if (!game?.bgg_rating) return null;
      return { ...gs, gap: gs.avg - game.bgg_rating };
    })
    .filter((x): x is GameStats & { gap: number } => x !== null);

  if (bggComparisons.length > 0) {
    const byGemGap = [...bggComparisons].sort((a, b) => b.gap - a.gap);
    const gemHolders = categoryWinners(
      byGemGap.filter((x) => x.gap > 0),
      gameMap,
      (gs) => {
        const g = gs as GameStats & { gap: number };
        return `+${g.gap.toFixed(1)} vs BGG`;
      }
    );
    if (gemHolders.length > 0) {
      achievements.push({
        title: "Hidden Gem",
        description: "We rate it much higher than the rest of the world",
        icon: "💎",
        holders: gemHolders,
      });
    }

    const byOverrated = [...bggComparisons].sort((a, b) => a.gap - b.gap);
    const overratedHolders = categoryWinners(
      byOverrated.filter((x) => x.gap < 0),
      gameMap,
      (gs) => {
        const g = gs as GameStats & { gap: number };
        return `${g.gap.toFixed(1)} vs BGG`;
      }
    );
    if (overratedHolders.length > 0) {
      achievements.push({
        title: "Overrated",
        description: "BGG loves it more than we do",
        icon: "📉",
        holders: overratedHolders,
      });
    }
  }

  // --- Collection-based achievements ---
  const ownedByCategory = new Map<number, number>();
  const wishlistByCategory = new Map<number, number>();
  for (const row of collectionRes.data ?? []) {
    if (row.owned) {
      ownedByCategory.set(
        row.bgg_id,
        (ownedByCategory.get(row.bgg_id) ?? 0) + 1
      );
    }
    if (row.wishlist) {
      wishlistByCategory.set(
        row.bgg_id,
        (wishlistByCategory.get(row.bgg_id) ?? 0) + 1
      );
    }
  }

  const ownedStats: GameStats[] = [...ownedByCategory.entries()]
    .filter(([, count]) => count >= MIN_RATERS)
    .map(([bggId, count]) => ({ bggId, avg: count, stdDev: 0, count }));
  const byOwned = ownedStats.sort((a, b) => b.avg - a.avg);
  const ownedHolders = categoryWinners(
    byOwned,
    gameMap,
    (gs) => `owned by ${gs.count} people`
  );
  if (ownedHolders.length > 0) {
    achievements.push({
      title: "Most Owned",
      description: "The game most people in the group own",
      icon: "📦",
      holders: ownedHolders,
    });
  }

  const wishlistStats: GameStats[] = [...wishlistByCategory.entries()]
    .filter(([, count]) => count >= MIN_RATERS)
    .map(([bggId, count]) => ({ bggId, avg: count, stdDev: 0, count }));
  const byWishlisted = wishlistStats.sort((a, b) => b.avg - a.avg);
  const wishlistHolders = categoryWinners(
    byWishlisted,
    gameMap,
    (gs) => `wishlisted by ${gs.count} people`
  );
  if (wishlistHolders.length > 0) {
    achievements.push({
      title: "Most Wishlisted",
      description: "The game on the most wishlists",
      icon: "⭐",
      holders: wishlistHolders,
    });
  }

  return achievements;
}
