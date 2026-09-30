import { MetricToggle } from "@/components/metric-toggle";
import { metric, request } from "@/lib/api";
import { difficultyTier } from "@/lib/metrics";
import { createClient } from "@/lib/supabase/server";
import { TierListBoard } from "./tier-list-board";
import { TierCategoryToggle } from "./category-toggle";

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

  const ranking = await request(`/api/rankings/${metric()}/${initialCategory}`);
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
      Promise.resolve({
        data: ranking.placements.map((p) => ({
          ...p,
          bgg_id: Number(p.id),
          tier: metric() === "difficulty" ? difficultyTier(p.tier) : p.tier,
        })),
      }),
    ]);

  const catalog = new Set(
    (initialCategory === "board" ? boardGames : partyGames).map(
      (g) => g.bgg_id,
    ),
  );
  if (placements.some((p) => !catalog.has(p.bgg_id)))
    throw new Error(
      "The collection changed while loading. Try again to refresh your rankings safely.",
    );

  return (
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <h1 className="font-display text-display-lg text-primary">
          The Tier Forge
        </h1>
        <p className="max-w-2xl text-on-surface-variant">
          Drag each beast into its rank, from legendary S-tier to the F-tier
          cull pile. Your verdicts feed the shared codex scores.
        </p>
      </section>
      <div className="mb-4">
        <MetricToggle />
      </div>
      <div className="relative">
        <TierCategoryToggle category={initialCategory} />
        <TierListBoard
          key={`${initialCategory}:${metric()}:${ranking.revision}:${[...catalog].join(",")}`}
          partyGames={partyGames ?? []}
          boardGames={boardGames ?? []}
          allPlacements={placements ?? []}
          initialCategory={initialCategory}
          revision={ranking.revision}
        />
      </div>
    </div>
  );
}
