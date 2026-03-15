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
    supabase.from("tier_placements").select("user_id, bgg_id, score"),
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
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
