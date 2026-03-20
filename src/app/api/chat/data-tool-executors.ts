import type { SupabaseClient, ToolInput } from "./data-tools";

const MIN_RATINGS = 3;

/** Executes a tool call against Supabase and returns formatted results. */
export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  input: ToolInput,
): Promise<string> {
  switch (toolName) {
    case "get_user_rankings":
      return executeUserRankings(supabase, userId, input);
    case "get_collection":
      return executeCollection(supabase, input);
    case "get_community_rankings":
      return executeCommunityRankings(supabase, input);
    case "get_game_details":
      return executeGameDetails(supabase, userId, input);
    case "compare_scores":
      return executeCompareScores(supabase, userId, input);
    case "get_unranked_games":
      return executeUnrankedGames(supabase, userId, input);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function executeUserRankings(
  supabase: SupabaseClient,
  userId: string,
  input: ToolInput,
): Promise<string> {
  const { data: placements } = await supabase
    .from("tier_placements")
    .select("bgg_id, tier, score")
    .eq("user_id", userId);

  const { data: allPlacements } = await supabase
    .from("tier_placements")
    .select("bgg_id, score");

  const bggIds = (placements ?? []).map((p) => p.bgg_id);
  if (bggIds.length === 0) return "No games ranked yet.";

  const { data: games } = await supabase
    .from("board_games")
    .select("bgg_id, name, bgg_rating")
    .in("bgg_id", bggIds);

  const gameMap = new Map((games ?? []).map((g) => [g.bgg_id, g]));

  const scoreAcc = new Map<number, { total: number; count: number }>();
  for (const p of allPlacements ?? []) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
  }

  let rows = (placements ?? [])
    .filter((p) => p.score != null)
    .map((p) => {
      const g = gameMap.get(p.bgg_id);
      const community = scoreAcc.get(p.bgg_id);
      const communityAvg =
        community && community.count >= MIN_RATINGS
          ? (Math.round((community.total / community.count) * 10) / 10).toFixed(1)
          : "n/a";
      return {
        name: g?.name ?? `Unknown (${p.bgg_id})`,
        tier: p.tier,
        score: p.score as number,
        bggRating: g?.bgg_rating ? Number(g.bgg_rating).toFixed(1) : "n/a",
        communityAvg,
      };
    });

  const orderBy = input.order_by ?? "score_desc";
  if (orderBy === "score_desc") rows.sort((a, b) => b.score - a.score);
  else if (orderBy === "score_asc") rows.sort((a, b) => a.score - b.score);
  else rows.sort((a, b) => a.name.localeCompare(b.name));

  if (input.limit) rows = rows.slice(0, input.limit);

  const header = "Game | Tier | User Score | BGG Rating | Community Avg";
  const lines = rows.map(
    (r) => `${r.name} | ${r.tier} | ${r.score.toFixed(1)} | ${r.bggRating} | ${r.communityAvg}`,
  );
  return `${header}\n${lines.join("\n")}`;
}

async function executeCollection(
  supabase: SupabaseClient,
  input: ToolInput,
): Promise<string> {
  let query = supabase
    .from("board_games")
    .select(
      "bgg_id, name, bgg_rating, bgg_weight, category, min_players, max_players, playing_time, mechanics, categories",
    );

  if (input.category) query = query.eq("category", input.category);
  if (input.max_players_gte) query = query.gte("max_players", input.max_players_gte);
  if (input.max_time) query = query.lte("playing_time", input.max_time);
  if (input.min_weight) query = query.gte("bgg_weight", input.min_weight);
  if (input.max_weight) query = query.lte("bgg_weight", input.max_weight);

  const orderBy = input.order_by ?? "name";
  const orderMap: Record<string, { column: string; ascending: boolean }> = {
    name: { column: "name", ascending: true },
    bgg_rating_desc: { column: "bgg_rating", ascending: false },
    weight_desc: { column: "bgg_weight", ascending: false },
    weight_asc: { column: "bgg_weight", ascending: true },
    time_asc: { column: "playing_time", ascending: true },
    time_desc: { column: "playing_time", ascending: false },
  };
  const order = orderMap[orderBy] ?? orderMap.name;
  query = query.order(order.column, { ascending: order.ascending });

  if (input.limit) query = query.limit(input.limit);

  const { data: games } = await query;

  const lines = (games ?? []).map((g) => {
    const parts: string[] = [];
    if (g.min_players && g.max_players) parts.push(`${g.min_players}-${g.max_players}p`);
    if (g.playing_time) parts.push(`${g.playing_time}min`);
    if (g.bgg_weight) parts.push(`w${Number(g.bgg_weight).toFixed(1)}`);
    if (g.bgg_rating) parts.push(`BGG ${Number(g.bgg_rating).toFixed(1)}`);
    if (g.category) parts.push(g.category);
    if (g.mechanics?.length) parts.push(`mechanics: ${g.mechanics.join(", ")}`);
    if (g.categories?.length) parts.push(`categories: ${g.categories.join(", ")}`);
    return `${g.name} (${parts.join(", ")})`;
  });

  return lines.length > 0 ? lines.join("\n") : "No games found matching filters.";
}

async function executeCommunityRankings(
  supabase: SupabaseClient,
  input: ToolInput,
): Promise<string> {
  const { data: placements } = await supabase
    .from("tier_placements")
    .select("bgg_id, score");

  const { data: games } = await supabase
    .from("board_games")
    .select("bgg_id, name, bgg_rating");

  const gameMap = new Map((games ?? []).map((g) => [g.bgg_id, g]));

  const scoreAcc = new Map<number, { total: number; count: number }>();
  for (const p of placements ?? []) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
  }

  let rows = [...scoreAcc.entries()]
    .filter(([, { count }]) => count >= MIN_RATINGS)
    .map(([bggId, { total, count }]) => {
      const g = gameMap.get(bggId);
      const avg = Math.round((total / count) * 10) / 10;
      return {
        name: g?.name ?? `Unknown (${bggId})`,
        avg,
        bggRating: g?.bgg_rating ? Number(g.bgg_rating).toFixed(1) : "n/a",
        raters: count,
      };
    });

  const orderBy = input.order_by ?? "avg_desc";
  if (orderBy === "avg_desc") rows.sort((a, b) => b.avg - a.avg);
  else if (orderBy === "avg_asc") rows.sort((a, b) => a.avg - b.avg);
  else rows.sort((a, b) => a.name.localeCompare(b.name));

  if (input.limit) rows = rows.slice(0, input.limit);

  const header = "Game | Community Avg | BGG Rating | # Raters";
  const lines = rows.map(
    (r) => `${r.name} | ${r.avg.toFixed(1)} | ${r.bggRating} | ${r.raters}`,
  );
  return `${header}\n${lines.join("\n")}`;
}

async function executeGameDetails(
  supabase: SupabaseClient,
  userId: string,
  input: ToolInput,
): Promise<string> {
  const names = input.game_names ?? [];
  if (names.length === 0) return "No game names provided.";

  const { data: allGames } = await supabase
    .from("board_games")
    .select(
      "bgg_id, name, bgg_rating, bgg_weight, category, min_players, max_players, playing_time, mechanics, categories, description, year_published, designers",
    );

  const { data: userPlacements } = await supabase
    .from("tier_placements")
    .select("bgg_id, tier, score")
    .eq("user_id", userId);

  const { data: allPlacements } = await supabase
    .from("tier_placements")
    .select("bgg_id, score");

  const userPlacementMap = new Map(
    (userPlacements ?? []).map((p) => [p.bgg_id, p]),
  );

  const scoreAcc = new Map<number, { total: number; count: number }>();
  for (const p of allPlacements ?? []) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
  }

  const matched = (allGames ?? []).filter((g) =>
    names.some((n) => g.name.toLowerCase().includes(n.toLowerCase())),
  );

  if (matched.length === 0) return `No games found matching: ${names.join(", ")}`;

  const details = matched.map((g) => {
    const up = userPlacementMap.get(g.bgg_id);
    const community = scoreAcc.get(g.bgg_id);
    const communityAvg =
      community && community.count >= MIN_RATINGS
        ? (Math.round((community.total / community.count) * 10) / 10).toFixed(1)
        : "n/a";

    const lines = [
      `**${g.name}** (${g.year_published ?? "?"})`,
      `Players: ${g.min_players}-${g.max_players} | Time: ${g.playing_time}min | Weight: ${g.bgg_weight ? Number(g.bgg_weight).toFixed(1) : "n/a"} | Category: ${g.category}`,
      `BGG Rating: ${g.bgg_rating ? Number(g.bgg_rating).toFixed(1) : "n/a"} | User Score: ${up ? up.score?.toFixed(1) : "unranked"} (${up ? `Tier ${up.tier}` : "no tier"}) | Community: ${communityAvg}`,
      g.mechanics?.length ? `Mechanics: ${g.mechanics.join(", ")}` : null,
      g.categories?.length ? `Categories: ${g.categories.join(", ")}` : null,
      g.designers?.length ? `Designers: ${g.designers.join(", ")}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  });

  return details.join("\n\n");
}

async function executeCompareScores(
  supabase: SupabaseClient,
  userId: string,
  input: ToolInput,
): Promise<string> {
  const compareAgainst = input.compare_against ?? "bgg";
  const direction = input.direction ?? "both";
  const minDiff = input.min_difference ?? 0;

  const { data: userPlacements } = await supabase
    .from("tier_placements")
    .select("bgg_id, tier, score")
    .eq("user_id", userId);

  const bggIds = (userPlacements ?? []).filter((p) => p.score != null).map((p) => p.bgg_id);
  if (bggIds.length === 0) return "No games ranked yet.";

  const { data: games } = await supabase
    .from("board_games")
    .select("bgg_id, name, bgg_rating")
    .in("bgg_id", bggIds);

  const gameMap = new Map((games ?? []).map((g) => [g.bgg_id, g]));

  const communityMap = new Map<number, number>();
  if (compareAgainst === "community") {
    const { data: allPlacements } = await supabase
      .from("tier_placements")
      .select("bgg_id, score");

    const acc = new Map<number, { total: number; count: number }>();
    for (const p of allPlacements ?? []) {
      if (p.score == null) continue;
      const entry = acc.get(p.bgg_id) ?? { total: 0, count: 0 };
      entry.total += p.score;
      entry.count += 1;
      acc.set(p.bgg_id, entry);
    }
    for (const [bggId, { total, count }] of acc) {
      if (count >= MIN_RATINGS) {
        communityMap.set(bggId, Math.round((total / count) * 10) / 10);
      }
    }
  }

  const compareLabel = compareAgainst === "bgg" ? "BGG Rating" : "Community Avg";

  let rows = (userPlacements ?? [])
    .filter((p) => p.score != null)
    .map((p) => {
      const g = gameMap.get(p.bgg_id);
      if (!g) return null;

      let compareValue: number | null = null;
      if (compareAgainst === "bgg") {
        compareValue = g.bgg_rating ? Number(g.bgg_rating) : null;
      } else {
        compareValue = communityMap.get(p.bgg_id) ?? null;
      }

      if (compareValue == null) return null;

      const userScore = p.score as number;
      const diff = Math.round((userScore - compareValue) * 10) / 10;

      return {
        name: g.name,
        tier: p.tier,
        userScore,
        compareValue,
        diff,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (direction === "user_higher") {
    rows = rows.filter((r) => r.diff > 0);
  } else if (direction === "user_lower") {
    rows = rows.filter((r) => r.diff < 0);
  }

  if (minDiff > 0) {
    rows = rows.filter((r) => Math.abs(r.diff) >= minDiff);
  }

  const orderBy = input.order_by ?? "difference_desc";
  if (orderBy === "difference_desc") {
    rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  } else {
    rows.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
  }

  if (input.limit) rows = rows.slice(0, input.limit);

  if (rows.length === 0) return "No games match the comparison criteria.";

  const header = `Game | Tier | User Score | ${compareLabel} | Difference`;
  const lines = rows.map(
    (r) =>
      `${r.name} | ${r.tier} | ${r.userScore.toFixed(1)} | ${r.compareValue.toFixed(1)} | ${r.diff > 0 ? "+" : ""}${r.diff.toFixed(1)}`,
  );
  return `${header}\n${lines.join("\n")}`;
}

async function executeUnrankedGames(
  supabase: SupabaseClient,
  userId: string,
  input: ToolInput,
): Promise<string> {
  const { data: userPlacements } = await supabase
    .from("tier_placements")
    .select("bgg_id")
    .eq("user_id", userId);

  const rankedIds = new Set((userPlacements ?? []).map((p) => p.bgg_id));

  let query = supabase
    .from("board_games")
    .select("bgg_id, name, bgg_rating, bgg_weight, category, min_players, max_players, playing_time, mechanics")
    .order("name");

  if (input.category) query = query.eq("category", input.category);
  if (input.max_players_gte) query = query.gte("max_players", input.max_players_gte);
  if (input.max_time) query = query.lte("playing_time", input.max_time);

  const { data: games } = await query;

  const unranked = (games ?? []).filter((g) => !rankedIds.has(g.bgg_id));

  if (unranked.length === 0) return "All matching games have been ranked!";

  const lines = unranked.map((g) => {
    const parts: string[] = [];
    if (g.min_players && g.max_players) parts.push(`${g.min_players}-${g.max_players}p`);
    if (g.playing_time) parts.push(`${g.playing_time}min`);
    if (g.bgg_weight) parts.push(`w${Number(g.bgg_weight).toFixed(1)}`);
    if (g.bgg_rating) parts.push(`BGG ${Number(g.bgg_rating).toFixed(1)}`);
    if (g.category) parts.push(g.category);
    return `${g.name} (${parts.join(", ")})`;
  });

  return lines.join("\n");
}
