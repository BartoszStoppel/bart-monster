import { createClient } from "@/lib/supabase/server";
import { GamePicker } from "./game-picker";

export const dynamic = "force-dynamic";

export default async function PickerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profiles },
    { data: games },
    { data: collections },
    { data: placements },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .order("display_name"),
    supabase.from("board_games").select("*").order("name"),
    supabase
      .from("user_game_collection")
      .select("user_id, bgg_id")
      .eq("owned", true),
    supabase.from("tier_placements").select("user_id, bgg_id, score, tier").limit(10000),
  ]);

  const ownershipMap: Record<string, number[]> = {};
  for (const c of collections ?? []) {
    if (!ownershipMap[c.user_id]) ownershipMap[c.user_id] = [];
    ownershipMap[c.user_id].push(c.bgg_id);
  }

  // Build per-user score map: { [userId]: { [bggId]: score } }
  const userScoreMap: Record<string, Record<string, number>> = {};
  for (const p of placements ?? []) {
    if (p.score == null) continue;
    if (!userScoreMap[p.user_id]) userScoreMap[p.user_id] = {};
    userScoreMap[p.user_id][String(p.bgg_id)] = p.score;
  }

  // Build per-game tier set: { [bggId]: Set of tiers any user placed it in }
  const gameTierMap: Record<string, Set<string>> = {};
  for (const p of placements ?? []) {
    if (!p.tier) continue;
    const key = String(p.bgg_id);
    if (!gameTierMap[key]) gameTierMap[key] = new Set();
    gameTierMap[key].add(p.tier);
  }
  // Convert sets to arrays for serialization
  const gameTiers: Record<string, string[]> = {};
  for (const [bggId, tiers] of Object.entries(gameTierMap)) {
    gameTiers[bggId] = [...tiers];
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Game Picker
      </h1>
      <GamePicker
        profiles={profiles ?? []}
        games={games ?? []}
        ownershipMap={ownershipMap}
        userScoreMap={userScoreMap}
        gameTiers={gameTiers}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
