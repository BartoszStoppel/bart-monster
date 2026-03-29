import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getHouseholdIds } from "@/lib/household";
import Link from "next/link";
import { SortableGameGrid } from "./sortable-game-grid";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const householdIds = user ? await getHouseholdIds(supabase, user.id) : [];

  const [{ data: games }, { data: placements }, { data: profiles }, { data: owned }, { data: wishlisted }] =
    await Promise.all([
      supabase.from("board_games").select("*").order("name"),
      supabase.from("tier_placements").select("user_id, bgg_id, score, tier, position"),
      supabase.from("profiles").select("id, display_name"),
      user
        ? supabase
            .from("user_game_collection")
            .select("bgg_id")
            .in("user_id", householdIds)
            .eq("owned", true)
        : Promise.resolve({ data: [] as { bgg_id: number }[] }),
      user
        ? supabase
            .from("user_game_collection")
            .select("bgg_id")
            .in("user_id", householdIds)
            .eq("wishlist", true)
        : Promise.resolve({ data: [] as { bgg_id: number }[] }),
    ]);

  const ownedSet = new Set((owned ?? []).map((o) => o.bgg_id));
  const wishlistSet = new Set((wishlisted ?? []).map((w) => w.bgg_id));
  const admin = await isAdmin(supabase);

  const avgScoreMap = new Map<number, number>();
  const scoreAcc = new Map<number, { total: number; count: number }>();
  for (const p of placements ?? []) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
  }
  const MIN_RATINGS = 3;
  for (const [bggId, { total, count }] of scoreAcc) {
    if (count >= MIN_RATINGS) {
      avgScoreMap.set(bggId, total / count);
    }
  }

  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameMap.set(p.id, p.display_name);
  }

  const gameCategory = new Map<number, string>();
  for (const g of games ?? []) {
    gameCategory.set(g.bgg_id, g.category);
  }

  const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, F: 5 };
  type CatBadges = { gold: string[]; silver: string[]; bronze: string[]; trash: string[] };
  const badgeMap: Record<number, { board?: CatBadges; party?: CatBadges }> = {};
  const byUserCat = new Map<string, { bgg_id: number; tier: string; position: number }[]>();
  for (const p of placements ?? []) {
    const cat = gameCategory.get(p.bgg_id) ?? "board";
    const key = `${p.user_id}::${cat}`;
    const list = byUserCat.get(key) ?? [];
    list.push({ bgg_id: p.bgg_id, tier: p.tier, position: p.position });
    byUserCat.set(key, list);
  }
  for (const [key, userPlacements] of byUserCat) {
    const [userId, cat] = key.split("::");
    const sorted = userPlacements.sort(
      (a, b) => (TIER_ORDER[a.tier] ?? 6) - (TIER_ORDER[b.tier] ?? 6) || a.position - b.position
    );
    const name = nameMap.get(userId) ?? "Unknown";
    const medalKeys: Array<"gold" | "silver" | "bronze"> = ["gold", "silver", "bronze"];
    const catKey = cat as "board" | "party";
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const id = sorted[i].bgg_id;
      badgeMap[id] ??= {};
      badgeMap[id][catKey] ??= { gold: [], silver: [], bronze: [], trash: [] };
      badgeMap[id][catKey][medalKeys[i]].push(name);
    }
    if (sorted.length > 0) {
      const lastId = sorted[sorted.length - 1].bgg_id;
      badgeMap[lastId] ??= {};
      badgeMap[lastId][catKey] ??= { gold: [], silver: [], bronze: [], trash: [] };
      badgeMap[lastId][catKey].trash.push(name);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Collection
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {games?.length ?? 0} games in the group collection
          </p>
        </div>
        <Link
          href="/search"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add Game
        </Link>
      </div>

      {games && games.length > 0 ? (
        <SortableGameGrid
          games={games}
          avgScoreMap={Object.fromEntries(avgScoreMap)}
          ownedSet={[...ownedSet]}
          wishlistSet={[...wishlistSet]}
          isAdmin={admin}
          badgeMap={badgeMap}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No games in the collection yet.
          </p>
          <Link
            href="/search"
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Search and add your first game
          </Link>
        </div>
      )}
    </div>
  );
}
