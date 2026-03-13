import { createClient } from "@/lib/supabase/server";
import { CategoryToggle } from "@/components/category-toggle";
import { ScoreComparisonChart } from "./score-chart";
import { ComplexityChart } from "./complexity-chart";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function StatisticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category =
    params.category === "party" ? "party" : ("board" as "party" | "board");

  const supabase = await createClient();

  const { data: games } = await supabase
    .from("board_games")
    .select("bgg_id, name, bgg_rating, bgg_weight")
    .eq("category", category)
    .order("name");

  const { data: placements } = await supabase
    .from("tier_placements")
    .select("bgg_id, tier, user_id, score");

  const gameBggIds = new Set((games ?? []).map((g) => g.bgg_id));

  const filteredPlacements = (placements ?? []).filter((p) =>
    gameBggIds.has(p.bgg_id)
  );

  const uniqueRankers = new Set(filteredPlacements.map((p) => p.user_id));

  const totalGames = games?.length ?? 0;
  const rankedGames = new Set(filteredPlacements.map((p) => p.bgg_id)).size;

  const avgScoreMap = new Map<number, { total: number; count: number }>();
  for (const p of filteredPlacements) {
    if (p.score == null) continue;
    const entry = avgScoreMap.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    avgScoreMap.set(p.bgg_id, entry);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Statistics
        </h1>
        <CategoryToggle category={category} basePath="/statistics" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Games" value={totalGames.toString()} />
        <StatCard label="Games Ranked" value={rankedGames.toString()} />
        <StatCard label="Rankers" value={uniqueRankers.size.toString()} />
      </div>

      {games && games.length > 0 ? (() => {
        const chartGames = games.map((g) => {
          const entry = avgScoreMap.get(g.bgg_id);
          return {
            name: g.name,
            bggId: g.bgg_id,
            ourScore: entry ? entry.total / entry.count : null,
            bggRating: g.bgg_rating ? Number(g.bgg_rating) : null,
            bggWeight: g.bgg_weight ? Number(g.bgg_weight) : null,
          };
        });
        const scoredChartGames = chartGames
          .filter((g) => g.ourScore != null)
          .sort((a, b) => (b.ourScore ?? 0) - (a.ourScore ?? 0));

        const sorted = [...games].sort((a, b) => {
          const aScore = avgScoreMap.get(a.bgg_id);
          const bScore = avgScoreMap.get(b.bgg_id);
          if (aScore && bScore) {
            return bScore.total / bScore.count - aScore.total / aScore.count;
          }
          if (aScore) return -1;
          if (bScore) return 1;
          return a.name.localeCompare(b.name);
        });
        return (
        <>
        <ScoreComparisonChart games={scoredChartGames} />
        <ComplexityChart games={chartGames} />
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Games
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Game</th>
                  <th className="pb-2 pr-4 text-right font-medium">Ours</th>
                  <th className="pb-2 pr-4 text-right font-medium">BGG</th>
                  <th className="pb-2 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((game) => (
                  <tr
                    key={game.bgg_id}
                    className="border-b border-zinc-100 dark:border-zinc-800/50"
                  >
                    <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <a
                        href={`/games/${game.bgg_id}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {game.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {avgScoreMap.has(game.bgg_id)
                        ? (
                            avgScoreMap.get(game.bgg_id)!.total /
                            avgScoreMap.get(game.bgg_id)!.count
                          ).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-600 dark:text-amber-400">
                      {game.bgg_rating
                        ? Number(game.bgg_rating).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-2 text-right text-zinc-500 dark:text-zinc-400">
                      {game.bgg_weight
                        ? Number(game.bgg_weight).toFixed(1)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
        );
      })() : (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No games yet. Add some games to see statistics here.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}
