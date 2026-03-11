import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface GameWithStats {
  bggId: number;
  name: string;
  bggRating: number | null;
  communityAvg: number | null;
  ratingCount: number;
  difference: number | null;
}

export default async function StatisticsPage() {
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("board_games")
    .select("bgg_id, name, bgg_rating")
    .order("name");

  const { data: ratings } = await supabase
    .from("game_ratings")
    .select("bgg_id, rating");

  const ratingsByGame = new Map<number, number[]>();
  if (ratings) {
    for (const r of ratings) {
      const existing = ratingsByGame.get(r.bgg_id) ?? [];
      existing.push(r.rating);
      ratingsByGame.set(r.bgg_id, existing);
    }
  }

  const gameStats: GameWithStats[] = (games ?? []).map((game) => {
    const gameRatings = ratingsByGame.get(game.bgg_id) ?? [];
    const communityAvg =
      gameRatings.length > 0
        ? gameRatings.reduce((a, b) => a + b, 0) / gameRatings.length
        : null;
    const bggRating = game.bgg_rating ? Number(game.bgg_rating) : null;
    const difference =
      communityAvg !== null && bggRating !== null
        ? communityAvg - bggRating
        : null;

    return {
      bggId: game.bgg_id,
      name: game.name,
      bggRating,
      communityAvg,
      ratingCount: gameRatings.length,
      difference,
    };
  });

  const ratedGames = gameStats.filter((g) => g.communityAvg !== null);
  const topRated = [...ratedGames].sort(
    (a, b) => (b.communityAvg ?? 0) - (a.communityAvg ?? 0)
  );
  const biggestDifference = [...ratedGames]
    .filter((g) => g.difference !== null)
    .sort((a, b) => Math.abs(b.difference!) - Math.abs(a.difference!));

  const totalGames = games?.length ?? 0;
  const totalRatings = ratings?.length ?? 0;
  const overallAvg =
    totalRatings > 0
      ? (ratings ?? []).reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Statistics
      </h1>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Games" value={totalGames.toString()} />
        <StatCard label="Total Ratings" value={totalRatings.toString()} />
        <StatCard
          label="Avg Rating"
          value={overallAvg ? overallAvg.toFixed(1) : "-"}
        />
        <StatCard label="Games Rated" value={ratedGames.length.toString()} />
      </div>

      {/* Top Rated */}
      {topRated.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Top Rated by Community
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">Game</th>
                  <th className="pb-2 pr-4 text-right font-medium">Ours</th>
                  <th className="pb-2 pr-4 text-right font-medium">BGG</th>
                  <th className="pb-2 text-right font-medium">Ratings</th>
                </tr>
              </thead>
              <tbody>
                {topRated.slice(0, 20).map((game, i) => (
                  <tr
                    key={game.bggId}
                    className="border-b border-zinc-100 dark:border-zinc-800/50"
                  >
                    <td className="py-2 pr-4 text-zinc-400">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <a
                        href={`/games/${game.bggId}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {game.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {game.communityAvg?.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-600 dark:text-amber-400">
                      {game.bggRating?.toFixed(1) ?? "-"}
                    </td>
                    <td className="py-2 text-right text-zinc-400">
                      {game.ratingCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Biggest Differences */}
      {biggestDifference.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Biggest Differences vs BGG
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Game</th>
                  <th className="pb-2 pr-4 text-right font-medium">Ours</th>
                  <th className="pb-2 pr-4 text-right font-medium">BGG</th>
                  <th className="pb-2 text-right font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {biggestDifference.slice(0, 20).map((game) => (
                  <tr
                    key={game.bggId}
                    className="border-b border-zinc-100 dark:border-zinc-800/50"
                  >
                    <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <a
                        href={`/games/${game.bggId}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {game.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {game.communityAvg?.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-600 dark:text-amber-400">
                      {game.bggRating?.toFixed(1) ?? "-"}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        game.difference! > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {game.difference! > 0 ? "+" : ""}
                      {game.difference?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalGames === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No statistics yet. Add some games and rate them to see data here.
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
