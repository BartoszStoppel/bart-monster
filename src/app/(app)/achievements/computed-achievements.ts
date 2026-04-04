import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlignmentEntry } from "../community/compute-alignment";

export interface AchievementHolder {
  display_name: string;
  avatar_url: string | null;
  avatar_urls?: string[];
  detail: string | null;
  category_label: string | null;
}

export type AchievementTone = "positive" | "negative" | "neutral";

export interface AchievementDisplay {
  title: string;
  description: string;
  icon: string;
  holders: AchievementHolder[];
  ranked?: boolean;
  tone?: AchievementTone;
  wide?: boolean;
}

interface ProfileEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  partner_id: string | null;
}

export type ProfileMap = Map<string, ProfileEntry>;

interface Household {
  memberIds: string[];
  display_name: string;
  avatar_urls: string[];
}

export function buildHouseholdMap(profileMap: ProfileMap): Map<string, Household> {
  const visited = new Set<string>();
  const households = new Map<string, Household>();

  for (const [userId, profile] of profileMap) {
    if (visited.has(userId)) continue;
    visited.add(userId);

    if (profile.partner_id && profileMap.has(profile.partner_id)) {
      const partner = profileMap.get(profile.partner_id)!;
      visited.add(profile.partner_id);
      const canonicalId =
        userId < profile.partner_id ? userId : profile.partner_id;
      const [first, second] =
        userId < profile.partner_id
          ? [profile, partner]
          : [partner, profile];
      households.set(canonicalId, {
        memberIds: [first.id, second.id],
        display_name: `${first.display_name} & ${second.display_name}`,
        avatar_urls: [first.avatar_url, second.avatar_url].filter(
          (url): url is string => url !== null
        ),
      });
    } else {
      households.set(userId, {
        memberIds: [userId],
        display_name: profile.display_name,
        avatar_urls: profile.avatar_url ? [profile.avatar_url] : [],
      });
    }
  }
  return households;
}

export function buildUserToHouseholdMap(profileMap: ProfileMap): Map<string, string> {
  const map = new Map<string, string>();
  const visited = new Set<string>();

  for (const [userId, profile] of profileMap) {
    if (visited.has(userId)) continue;
    visited.add(userId);

    if (profile.partner_id && profileMap.has(profile.partner_id)) {
      visited.add(profile.partner_id);
      const canonicalId =
        userId < profile.partner_id ? userId : profile.partner_id;
      map.set(userId, canonicalId);
      map.set(profile.partner_id, canonicalId);
    } else {
      map.set(userId, userId);
    }
  }
  return map;
}

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

/** Take entries covering the top N distinct values (includes all ties). */
export function topByDistinctValues(
  entries: [string, number][],
  n: number
): [string, number][] {
  const distinctValues = [...new Set(entries.map(([, v]) => v))].slice(0, n);
  const cutoff = distinctValues[distinctValues.length - 1];
  return entries.filter(([, v]) => v >= cutoff);
}

/** Same as topByDistinctValues but for lowest values. */
function bottomByDistinctValues(
  entries: [string, number][],
  n: number
): [string, number][] {
  const distinctValues = [...new Set(entries.map(([, v]) => v))].slice(0, n);
  const cutoff = distinctValues[distinctValues.length - 1];
  return entries.filter(([, v]) => v <= cutoff);
}

export async function computeCollectorAchievements(
  supabase: SupabaseClient,
  profileMap: ProfileMap
): Promise<[AchievementDisplay, AchievementDisplay, AchievementDisplay]> {
  const [{ data: ownership }, { data: placements }] = await Promise.all([
    supabase
      .from("user_game_collection")
      .select("user_id, bgg_id, owned"),
    supabase
      .from("tier_placements")
      .select("user_id, bgg_id")
      .limit(10000),
  ]);

  const householdMap = buildHouseholdMap(profileMap);
  const userToHousehold = buildUserToHouseholdMap(profileMap);

  // Seed all households with 0 so everyone appears
  const gamesByHousehold = new Map<string, Set<number>>();
  for (const hhId of householdMap.keys()) {
    gamesByHousehold.set(hhId, new Set<number>());
  }
  for (const row of ownership ?? []) {
    if (!row.owned) continue;
    const householdId = userToHousehold.get(row.user_id) ?? row.user_id;
    const games = gamesByHousehold.get(householdId) ?? new Set<number>();
    games.add(row.bgg_id);
    gamesByHousehold.set(householdId, games);
  }

  // Build per-user owned and ranked sets for shame calculation
  const ownedByUser = new Map<string, Set<number>>();
  for (const row of ownership ?? []) {
    if (!row.owned) continue;
    const games = ownedByUser.get(row.user_id) ?? new Set<number>();
    games.add(row.bgg_id);
    ownedByUser.set(row.user_id, games);
  }

  const rankedByUser = new Map<string, Set<number>>();
  for (const row of placements ?? []) {
    const games = rankedByUser.get(row.user_id) ?? new Set<number>();
    games.add(row.bgg_id);
    rankedByUser.set(row.user_id, games);
  }

  const sorted: [string, number][] = [...gamesByHousehold.entries()]
    .map(([householdId, games]) => [householdId, games.size] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  function toHolders(entries: [string, number][], label: string): AchievementHolder[] {
    return entries.map(([householdId, count]) => {
      const household = householdMap.get(householdId);
      return {
        display_name: household?.display_name ?? "Unknown",
        avatar_url: household?.avatar_urls[0] ?? null,
        avatar_urls: household?.avatar_urls ?? [],
        detail: `${count} ${count === 1 ? label : label + "s"}`,
        category_label: null,
      };
    });
  }

  const topCollectors = topByDistinctValues(sorted, 3);
  const bottomCollectors = bottomByDistinctValues(
    [...sorted].reverse(),
    3
  );

  // Shame: games each person owns but hasn't ranked, summed per household
  const shameByHousehold = new Map<string, number>();
  for (const [userId, owned] of ownedByUser) {
    const ranked = rankedByUser.get(userId) ?? new Set<number>();
    const unranked = [...owned].filter((bggId) => !ranked.has(bggId)).length;
    const hhId = userToHousehold.get(userId) ?? userId;
    shameByHousehold.set(hhId, (shameByHousehold.get(hhId) ?? 0) + unranked);
  }
  const unrankedByHousehold: [string, number][] = [...shameByHousehold.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const topShamed = topByDistinctValues(unrankedByHousehold, 3);

  const collector: AchievementDisplay = {
    title: "Board Game Collector",
    description: "Own the most board games in the group",
    icon: "🏆",
    ranked: true,
    holders: toHolders(topCollectors, "game"),
  };

  const freeloader: AchievementDisplay = {
    title: "Professional Freeloader",
    description: "Why buy games when your friends already did?",
    icon: "🛋️",
    ranked: true,
    holders: toHolders(bottomCollectors, "game"),
  };

  const shame: AchievementDisplay = {
    title: "Shelf of Shame",
    description: "Own the most games they haven't even ranked yet",
    icon: "🫣",
    ranked: true,
    tone: "negative",
    holders: toHolders(topShamed, "unranked game"),
  };

  return [collector, freeloader, shame];
}

export async function computeGameAchievements(
  supabase: SupabaseClient,
  profileMap: ProfileMap
): Promise<AchievementDisplay[]> {
  const [placementsRes, gamesRes, collectionRes] = await Promise.all([
    supabase.from("tier_placements").select("bgg_id, score").limit(10000),
    supabase
      .from("board_games")
      .select("bgg_id, name, thumbnail_url, bgg_rating, category"),
    supabase.from("user_game_collection").select("user_id, bgg_id, owned, wishlist"),
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

  // --- Collection-based achievements (household-aware) ---
  const userToHousehold = buildUserToHouseholdMap(profileMap);
  const householdMap = buildHouseholdMap(profileMap);

  const ownedHouseholds = new Map<number, Set<string>>();
  const wishlistHouseholds = new Map<number, Set<string>>();
  for (const row of collectionRes.data ?? []) {
    const hhId = userToHousehold.get(row.user_id) ?? row.user_id;
    if (row.owned) {
      const set = ownedHouseholds.get(row.bgg_id) ?? new Set<string>();
      set.add(hhId);
      ownedHouseholds.set(row.bgg_id, set);
    }
    if (row.wishlist) {
      const set = wishlistHouseholds.get(row.bgg_id) ?? new Set<string>();
      set.add(hhId);
      wishlistHouseholds.set(row.bgg_id, set);
    }
  }

  function householdNames(hhIds: Set<string>): string {
    return [...hhIds]
      .map((id) => householdMap.get(id)?.display_name ?? "Unknown")
      .join(", ");
  }

  const ownedStats: GameStats[] = [...ownedHouseholds.entries()]
    .filter(([, hhs]) => hhs.size >= MIN_RATERS)
    .map(([bggId, hhs]) => ({ bggId, avg: hhs.size, stdDev: 0, count: hhs.size }));
  const byOwned = ownedStats.sort((a, b) => b.avg - a.avg);
  const ownedHolders = categoryWinners(byOwned, gameMap, (gs) =>
    householdNames(ownedHouseholds.get(gs.bggId)!)
  );
  if (ownedHolders.length > 0) {
    achievements.push({
      title: "Most Owned",
      description: "The game most people in the group own",
      icon: "📦",
      holders: ownedHolders,
      wide: true,
    });
  }

  const wishlistStats: GameStats[] = [...wishlistHouseholds.entries()]
    .filter(([, hhs]) => hhs.size >= MIN_RATERS)
    .map(([bggId, hhs]) => ({ bggId, avg: hhs.size, stdDev: 0, count: hhs.size }));
  const byWishlisted = wishlistStats.sort((a, b) => b.avg - a.avg);
  const wishlistHolders = categoryWinners(byWishlisted, gameMap, (gs) =>
    householdNames(wishlistHouseholds.get(gs.bggId)!)
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

const ALIGNMENT_POINTS = [3, 2, 1];

/**
 * Compute "people awards" from stored alignment data in user_alignments table.
 * For each user, being someone's #1 taste twin = 3 pts, #2 = 2 pts, #3 = 1 pt.
 * Highest total = most agreeable. Same logic inverted for sworn enemies.
 */
export async function computePeopleAchievements(
  supabase: SupabaseClient,
  profileMap: ProfileMap
): Promise<AchievementDisplay[]> {
  const [{ data: alignmentRows }, { data: placementCounts }] = await Promise.all([
    supabase
      .from("user_alignments")
      .select("user_id, category, allies, rivals"),
    supabase
      .from("tier_placements")
      .select("user_id, bgg_id, board_games!inner(category)")
  ]);

  if (!alignmentRows?.length) return [];

  // Count placements per user per category
  const userCategoryCounts = new Map<string, number>();
  for (const row of placementCounts ?? []) {
    const cat = (row.board_games as unknown as { category: string }).category;
    const key = `${row.user_id}:${cat}`;
    userCategoryCounts.set(key, (userCategoryCounts.get(key) ?? 0) + 1);
  }

  const pleasers: AchievementDisplay[] = [];
  const menaces: AchievementDisplay[] = [];
  const loners: AchievementDisplay[] = [];

  const categoryConfig = [
    {
      category: "board" as const,
      label: "Board Games",
      pleaser: { title: "The People Pleaser", icon: "🤝" },
      menace: { title: "The Menace", icon: "😈" },
      loner: { title: "Vanilla Villain", icon: "🕵️" },
    },
    {
      category: "party" as const,
      label: "Party Games",
      pleaser: { title: "Life of the Party", icon: "🎉" },
      menace: { title: "The Party Pooper", icon: "💩" },
      loner: { title: "The Wallflower", icon: "🧍" },
    },
  ];

  for (const config of categoryConfig) {
    const rows = alignmentRows.filter((r) => r.category === config.category);

    const allyPoints = new Map<string, number>();
    const rivalPoints = new Map<string, number>();
    const participantIds = new Set<string>();

    for (const row of rows) {
      const count = userCategoryCounts.get(`${row.user_id}:${config.category}`) ?? 0;
      if (count < MIN_RATERS) continue;
      participantIds.add(row.user_id);
      const allies = row.allies as AlignmentEntry[];
      const rivals = row.rivals as AlignmentEntry[];

      for (let i = 0; i < allies.length; i++) {
        const id = allies[i].userId;
        allyPoints.set(id, (allyPoints.get(id) ?? 0) + ALIGNMENT_POINTS[i]);
      }
      for (let i = 0; i < rivals.length; i++) {
        const id = rivals[i].userId;
        rivalPoints.set(id, (rivalPoints.get(id) ?? 0) + ALIGNMENT_POINTS[i]);
      }
    }

    function toHolders(entries: [string, number][]): AchievementHolder[] {
      return entries.map(([userId, pts]) => {
        const profile = profileMap.get(userId);
        return {
          display_name: profile?.display_name ?? "Unknown",
          avatar_url: profile?.avatar_url ?? null,
          detail: `${pts} pts`,
          category_label: null,
        };
      });
    }

    // Most agreeable
    const sortedAllies = [...allyPoints.entries()]
      .sort((a, b) => b[1] - a[1]);
    const topAllies = topByDistinctValues(sortedAllies, 3);
    if (topAllies.length > 0) {
      pleasers.push({
        title: config.pleaser.title,
        description: `${config.label} — everyone's taste twin`,
        icon: config.pleaser.icon,
        holders: toHolders(topAllies),
        ranked: true,
        tone: "positive",
      });
    }

    // Least agreeable
    const sortedRivals = [...rivalPoints.entries()]
      .sort((a, b) => b[1] - a[1]);
    const topRivals = topByDistinctValues(sortedRivals, 3);
    if (topRivals.length > 0) {
      menaces.push({
        title: config.menace.title,
        description: `${config.label} — champion of the sworn enemies columns`,
        icon: config.menace.icon,
        holders: toHolders(topRivals),
        ranked: true,
        tone: "negative",
      });
    }

    // Loner — lowest combined ally + rival points (exclude pleasers & menaces)
    const excludedFromLoner = new Set([
      ...topAllies.map(([id]) => id),
      ...topRivals.map(([id]) => id),
    ]);
    const combinedPoints = new Map<string, number>();
    for (const id of participantIds) {
      if (excludedFromLoner.has(id)) continue;
      combinedPoints.set(
        id,
        (allyPoints.get(id) ?? 0) + (rivalPoints.get(id) ?? 0)
      );
    }
    const sortedCombined = [...combinedPoints.entries()]
      .sort((a, b) => a[1] - b[1]);
    const bottomCombined = bottomByDistinctValues(sortedCombined, 3);
    if (bottomCombined.length > 0) {
      loners.push({
        title: config.loner.title,
        description: `${config.label} — nobody's best friend or worst enemy`,
        icon: config.loner.icon,
        holders: toHolders(bottomCombined),
        ranked: true,
        tone: "neutral",
      });
    }
  }

  return [...pleasers, ...menaces, ...loners];
}
