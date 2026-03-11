import { createClient } from "@/lib/supabase/server";
import { GameCard } from "@/components/game-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("board_games")
    .select("*")
    .order("name");

  const { data: ratings } = await supabase
    .from("game_ratings")
    .select("bgg_id, rating");

  const avgRatings = new Map<number, number>();
  if (ratings) {
    const grouped = new Map<number, number[]>();
    for (const r of ratings) {
      const existing = grouped.get(r.bgg_id) ?? [];
      existing.push(r.rating);
      grouped.set(r.bgg_id, existing);
    }
    for (const [bggId, values] of grouped) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      avgRatings.set(bggId, avg);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Collection
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {games?.length ?? 0} games in the group collection
          </p>
        </div>
        <Link
          href="/search"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add Game
        </Link>
      </div>

      {games && games.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((game) => (
            <GameCard
              key={game.bgg_id}
              game={game}
              communityRating={avgRatings.get(game.bgg_id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">
            No games in the collection yet.
          </p>
          <Link
            href="/search"
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Search and add your first game
          </Link>
        </div>
      )}
    </div>
  );
}
