import { createClient } from "@/lib/supabase/server";
import { TierListBoard } from "./tier-list-board";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function TierListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialCategory =
    params.category === "party" ? "party" : ("board" as "party" | "board");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: partyGames }, { data: boardGames }, { data: placements }] =
    await Promise.all([
      supabase
        .from("board_games")
        .select("*")
        .eq("category", "party")
        .order("name"),
      supabase
        .from("board_games")
        .select("*")
        .eq("category", "board")
        .order("name"),
      supabase
        .from("tier_placements")
        .select("*")
        .eq("user_id", user!.id),
    ]);

  return (
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <h1 className="font-display text-display-lg text-primary">The Tier Forge</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Drag each beast into its rank, from legendary S-tier to the F-tier
          cull pile. Your verdicts feed the shared codex scores.
        </p>
      </section>
      <TierListBoard
        partyGames={partyGames ?? []}
        boardGames={boardGames ?? []}
        allPlacements={placements ?? []}
        initialCategory={initialCategory}
      />
    </div>
  );
}
