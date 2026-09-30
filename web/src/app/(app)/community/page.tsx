import { MetricToggle } from "@/components/metric-toggle";
import { metric } from "@/lib/api";
import { householdIds } from "@/lib/household";
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
      .from(
        metric() === "difficulty" ? "difficulty_placements" : "tier_placements",
      )
      .select("bgg_id, tier, position, user_id, score")
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
    {
      display_name: string;
      avatar_url: string | null;
      is_admin: boolean;
      partner_id: string | null;
    }
  >();
  for (const p of profiles ?? []) {
    if (p.is_active === false) continue;
    profileMap.set(p.id, {
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      is_admin: p.is_admin,
      partner_id: p.partner_id,
    });
  }

  const ownershipCounts = new Map<string, number>();
  for (const p of profiles ?? []) {
    const ids = new Set(householdIds(profiles ?? [], p.id));
    ownershipCounts.set(
      p.id,
      new Set(
        (collections ?? [])
          .filter((c) => ids.has(c.user_id))
          .map((c) => c.bgg_id),
      ).size,
    );
  }
  const { data: enjoyment } = await supabase
    .from("tier_placements")
    .select("*");
  const totalPlacementCounts = new Map<string, number>();
  for (const p of enjoyment ?? [])
    if (gameMap.has(p.bgg_id))
      totalPlacementCounts.set(
        p.user_id,
        (totalPlacementCounts.get(p.user_id) ?? 0) + 1,
      );

  const users = buildUserTierData(
    placements ?? [],
    gameMap,
    profileMap,
    ownershipCounts,
    totalPlacementCounts,
    true,
  );

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
    allies: Array.isArray(row.allies) ? (row.allies as AlignmentEntry[]) : [],
    rivals: Array.isArray(row.rivals) ? (row.rivals as AlignmentEntry[]) : [],
  }));

  return (
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display-lg text-primary">
              The Guild Hall
            </h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              See how every adventurer ranked their hoard, find your taste twins
              and sworn enemies, and survey where each stands in the pecking
              order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricToggle />
            <CategoryToggle category={category} basePath="/community" />
          </div>
        </div>
      </section>

      <CollapsibleSection
        title="Tier Lists"
        description="See how everyone ranked their games"
        preview={<CommunityTierLists users={users} allGames={games ?? []} />}
      >
        <CommunityTierLists users={users} allGames={games ?? []} />
      </CollapsibleSection>
      {metric() === "enjoyment" && (
        <SectionErrorBoundary name="Tier List Alignment">
          <CollapsibleSection
            title="Tier List Alignment"
            description="Find your taste twins and sworn enemies"
            preview={<AlignmentTable alignments={alignments} />}
          >
            <AlignmentTable alignments={alignments} />
          </CollapsibleSection>
        </SectionErrorBoundary>
      )}
      <CollapsibleSection
        title="Places in Society"
        description="Where everyone stands in the ranking hierarchy"
        preview={<RankLadder users={rankUsers} />}
      >
        <RankLadder users={rankUsers} />
      </CollapsibleSection>
    </div>
  );
}
