import { householdIds } from "@/lib/household";
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
      .select("id, display_name, avatar_url, partner_id")
      .order("display_name"),
    supabase.from("board_games").select("*").order("name"),
    supabase
      .from("user_game_collection")
      .select("user_id, bgg_id")
      .eq("owned", true),
    supabase
      .from("tier_placements")
      .select("user_id, bgg_id, score, tier")
      .limit(10000),
  ]);

  const ownershipMap: Record<string, number[]> = {};
  for (const c of collections ?? []) {
    if (!ownershipMap[c.user_id]) ownershipMap[c.user_id] = [];
    ownershipMap[c.user_id].push(c.bgg_id);
  }

  const households: {
    id: string;
    label: string;
    memberIds: string[];
    gameCount: number;
  }[] = [];
  const seen = new Set<string>();
  for (const p of profiles ?? []) {
    const memberIds = householdIds(profiles ?? [], p.id).sort();
    const id = memberIds[0];
    if (seen.has(id)) continue;
    seen.add(id);
    households.push({
      id,
      label: memberIds
        .map(
          (id) =>
            (profiles ?? []).find((p) => p.id === id)?.display_name ??
            "Unknown",
        )
        .join(" & "),
      memberIds,
      gameCount: new Set(memberIds.flatMap((id) => ownershipMap[id] ?? []))
        .size,
    });
  }

  // Build per-user score map: { [userId]: { [bggId]: score } }
  const userScoreMap: Record<string, Record<string, number>> = {};
  for (const p of placements ?? []) {
    if (p.score == null) continue;
    if (!userScoreMap[p.user_id]) userScoreMap[p.user_id] = {};
    userScoreMap[p.user_id][String(p.bgg_id)] = p.score;
  }

  const gameTiers: Record<string, Record<string, string>> = {};
  for (const p of placements ?? []) {
    gameTiers[p.user_id] ??= {};
    gameTiers[p.user_id][String(p.bgg_id)] = p.tier;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Game Picker
      </h1>
      <GamePicker
        profiles={(profiles ?? []).filter((p) => p.is_active !== false)}
        games={games ?? []}
        ownershipMap={ownershipMap}
        userScoreMap={userScoreMap}
        gameTiers={gameTiers}
        currentUserId={user?.id ?? null}
        households={households}
      />
    </div>
  );
}
