import { createClient } from "@/lib/supabase/server";
import { CategoryToggle } from "@/components/category-toggle";
import type { BoardGame } from "@/types/database";
import { CommunityTierLists } from "./community-tier-lists";
import { AlignmentTable } from "./alignment-table";
import type { AlignmentEntry, UserAlignment } from "./compute-alignment";
import { CollapsibleSection } from "./collapsible-section";
import { SectionErrorBoundary } from "./section-error-boundary";
import { buildUserTierData } from "./build-user-tier-data";
import { RankLadder } from "./rank-ladder";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ category?: string }>;
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
      .select("id, display_name, avatar_url, is_admin, partner_id"),
    supabase
      .from("user_game_collection")
      .select("user_id, bgg_id")
      .eq("owned", true),
  ]);

  const { data: alignmentRows } = await supabase
    .from("user_alignments")
    .select("user_id, display_name, avatar_url, allies, rivals")
    .eq("category", category);

  const gameMap = new Map<number, BoardGame>();
  for (const g of games ?? []) {
    gameMap.set(g.bgg_id, g);
  }

  const profileMap = new Map<
    string,
    { display_name: string; avatar_url: string | null; is_admin: boolean; partner_id: string | null }
  >();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, {
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      is_admin: p.is_admin,
      partner_id: p.partner_id,
    });
  }

  // Build household-aware ownership: partners share a deduplicated game set
  const householdGames = new Map<string, Set<number>>();
  for (const c of collections ?? []) {
    const profile = profileMap.get(c.user_id);
    const partnerId = profile?.partner_id;
    // Use the lower ID as the canonical household key
    const hhId = partnerId && partnerId < c.user_id ? partnerId : c.user_id;
    const games = householdGames.get(hhId) ?? new Set<number>();
    games.add(c.bgg_id);
    householdGames.set(hhId, games);
  }
  const ownershipCounts = new Map<string, number>();
  for (const [userId, profile] of profileMap) {
    const partnerId = profile.partner_id;
    const hhId = partnerId && partnerId < userId ? partnerId : userId;
    ownershipCounts.set(userId, householdGames.get(hhId)?.size ?? 0);
  }

  const totalPlacementCounts = new Map<string, number>();
  for (const p of placements ?? []) {
    totalPlacementCounts.set(p.user_id, (totalPlacementCounts.get(p.user_id) ?? 0) + 1);
  }

  const users = buildUserTierData(placements ?? [], gameMap, profileMap, ownershipCounts, totalPlacementCounts);

  const rankUsers = [...profileMap.entries()].map(([id, profile]) => ({
    userId: id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    totalGamesRanked: totalPlacementCounts.get(id) ?? 0,
    gamesOwned: ownershipCounts.get(id) ?? 0,
    partnerId: profile.partner_id,
  }));

  const alignments: UserAlignment[] = (alignmentRows ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    allies: Array.isArray(row.allies) ? row.allies as AlignmentEntry[] : [],
    rivals: Array.isArray(row.rivals) ? row.rivals as AlignmentEntry[] : [],
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Community
        </h1>
        <CategoryToggle category={category} basePath="/community" />
      </div>
      <CollapsibleSection
        title="Tier Lists"
        description="See how everyone ranked their games"
        preview={<CommunityTierLists users={users} allGames={games ?? []} />}
      >
        <CommunityTierLists users={users} allGames={games ?? []} />
      </CollapsibleSection>
      <div className="mt-6">
        <SectionErrorBoundary name="Tier List Alignment">
          <CollapsibleSection
            title="Tier List Alignment"
            description="Find your taste twins and sworn enemies"
            preview={<AlignmentTable alignments={alignments} />}
          >
            <AlignmentTable alignments={alignments} />
          </CollapsibleSection>
        </SectionErrorBoundary>
      </div>
      <div className="mt-6">
        <CollapsibleSection
          title="Places in Society"
          description="Where everyone stands in the ranking hierarchy"
          preview={<RankLadder users={rankUsers} />}
        >
          <RankLadder users={rankUsers} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
