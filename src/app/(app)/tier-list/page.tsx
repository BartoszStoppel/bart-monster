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
    <div>
      <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Tier List
      </h1>
      <TierListBoard
        partyGames={partyGames ?? []}
        boardGames={boardGames ?? []}
        allPlacements={placements ?? []}
        initialCategory={initialCategory}
      />
    </div>
  );
}
