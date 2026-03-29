import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryToggle } from "@/components/category-toggle";
import type { BoardGame } from "@/types/database";
import { CommunityTierLists } from "./community-tier-lists";
import { AlignmentTable } from "./alignment-table";
import type { AlignmentEntry, UserAlignment } from "./compute-alignment";
import { CollapsibleSection } from "./collapsible-section";
import { buildUserTierData } from "./build-user-tier-data";

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
    { data: alignmentRows },
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
    supabase
      .from("user_alignments")
      .select("user_id, display_name, avatar_url, allies, rivals")
      .eq("category", category)
      .then((res) => {
        if (res.error) console.error("[community] user_alignments query error:", res.error);
        return res;
      }),
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

  const alignments: UserAlignment[] = (alignmentRows ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    allies: row.allies as AlignmentEntry[],
    rivals: row.rivals as AlignmentEntry[],
  }));

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
