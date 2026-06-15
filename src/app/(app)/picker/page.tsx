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
    supabase.from("tier_placements").select("user_id, bgg_id, score, tier").limit(10000),
  ]);

  const ownershipMap: Record<string, number[]> = {};
  for (const c of collections ?? []) {
    if (!ownershipMap[c.user_id]) ownershipMap[c.user_id] = [];
    ownershipMap[c.user_id].push(c.bgg_id);
  }

  // Build households: merge partnered users into a single entry with combined ownership
  const visited = new Set<string>();
  const households: { id: string; label: string; memberIds: string[]; gameCount: number }[] = [];
  for (const p of profiles ?? []) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    if (p.partner_id && (profiles ?? []).some((pp) => pp.id === p.partner_id)) {
      const partner = (profiles ?? []).find((pp) => pp.id === p.partner_id)!;
      visited.add(partner.id);
      const memberIds = [p.id, partner.id];
      const combined = new Set([
        ...(ownershipMap[p.id] ?? []),
        ...(ownershipMap[partner.id] ?? []),
      ]);
      households.push({
        id: p.id < partner.id ? p.id : partner.id,
        label: `${p.display_name} & ${partner.display_name}`,
        memberIds,
        gameCount: combined.size,
      });
    } else {
      households.push({
        id: p.id,
        label: p.display_name,
        memberIds: [p.id],
        gameCount: (ownershipMap[p.id] ?? []).length,
      });
    }
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
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <h1 className="font-display text-display-lg text-primary">The Summoning Wheel</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Let fate choose tonight&apos;s quest. Set the table, weight the odds,
          and spin to summon a game from the collection.
        </p>
      </section>
      <GamePicker
        profiles={profiles ?? []}
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
