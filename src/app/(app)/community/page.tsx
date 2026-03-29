import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryToggle } from "@/components/category-toggle";
import type { BoardGame, Tier, TierPlacement } from "@/types/database";
import { CommunityTierLists } from "./community-tier-lists";
import type { UserTierData } from "./community-tier-lists";
import { AlignmentTable } from "./alignment-table";
import { computeAlignments } from "./compute-alignment";
import { CollapsibleSection } from "./collapsible-section";

export const dynamic = "force-dynamic";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

function buildUserTierData(
  placements: Pick<TierPlacement, "bgg_id" | "tier" | "position" | "user_id">[],
  gameMap: Map<number, BoardGame>,
  profileMap: Map<string, { display_name: string; avatar_url: string | null }>,
  ownershipCounts: Map<string, number>
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
    });
  }

  result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return result;
}

export default async function CommunityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category =
    params.category === "party" ? "party" : ("board" as "party" | "board");

  const supabase = await createClient();

  const [
    { data: games },
    { data: placements },
    { data: profiles },
    { data: collections },
  ] = await Promise.all([
    supabase
      .from("board_games")
      .select("*")
      .eq("category", category)
      .order("name"),
    supabase
      .from("tier_placements")
      .select("bgg_id, tier, position, user_id")
      .limit(10000),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url"),
    supabase
      .from("user_game_collection")
      .select("user_id")
      .eq("owned", true),
  ]);

  const gameMap = new Map<number, BoardGame>();
  for (const g of games ?? []) {
    gameMap.set(g.bgg_id, g);
  }

  const profileMap = new Map<
    string,
    { display_name: string; avatar_url: string | null }
  >();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, {
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    });
  }

  const ownershipCounts = new Map<string, number>();
  for (const c of collections ?? []) {
    ownershipCounts.set(c.user_id, (ownershipCounts.get(c.user_id) ?? 0) + 1);
  }

  const users = buildUserTierData(placements ?? [], gameMap, profileMap, ownershipCounts);
  const alignments = computeAlignments(users);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Community
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/tier-list"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Add your rankings
          </Link>
          <CategoryToggle category={category} basePath="/community" />
        </div>
      </div>
      <CollapsibleSection
        title="Tier Lists"
        description="See how everyone ranked their games"
        preview={<CommunityTierLists users={users} />}
      >
        <CommunityTierLists users={users} />
      </CollapsibleSection>
      <div className="mt-6">
        <CollapsibleSection
          title="Tier List Alignment"
          description="Find your taste twins and sworn enemies"
          preview={<AlignmentTable alignments={alignments} />}
        >
          <AlignmentTable alignments={alignments} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
