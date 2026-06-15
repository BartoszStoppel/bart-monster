import { createClient } from "@/lib/supabase/server";
import { CategoryToggle } from "@/components/category-toggle";
import { ComplexityChart } from "./complexity-chart";
import { DistributionChart } from "./distribution-chart";

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
    .select("bgg_id, name, bgg_rating, bgg_weight, thumbnail_url")
    .eq("category", category)
    .order("name");

  const { data: { user } } = await supabase.auth.getUser();

  const { data: placements } = await supabase
    .from("tier_placements")
    .select("bgg_id, tier, user_id, score")
    .limit(10000);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name");

  const { data: snapshots } = await supabase
    .from("score_snapshots")
    .select("bgg_id, user_id, score, snapshot_at")
    .order("snapshot_at")
    .limit(50000);

  const gameBggIds = new Set((games ?? []).map((g) => g.bgg_id));

  const filteredPlacements = (placements ?? []).filter((p) =>
    gameBggIds.has(p.bgg_id)
  );

  const uniqueRankers = new Set(filteredPlacements.map((p) => p.user_id));

  const totalGames = games?.length ?? 0;
  const rankedGames = new Set(filteredPlacements.map((p) => p.bgg_id)).size;

  const MIN_RATINGS = 3;
  const scoreAcc = new Map<number, { total: number; count: number }>();
  const yourScoreMap = new Map<number, number>();
  for (const p of filteredPlacements) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
    if (user && p.user_id === user.id) {
      yourScoreMap.set(p.bgg_id, p.score);
    }
  }
  const avgScoreMap = new Map<number, { total: number; count: number }>();
  for (const [bggId, entry] of scoreAcc) {
    if (entry.count >= MIN_RATINGS) {
      avgScoreMap.set(bggId, entry);
    }
  }

  return (
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display-lg text-primary">The Oracle&apos;s Ledger</h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Divine the numbers behind the codex — score distributions, complexity
              curves, and how the party&apos;s verdicts stack against the wider world.
            </p>
          </div>
          <CategoryToggle category={category} basePath="/statistics" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-gutter sm:grid-cols-3">
        <StatCard label="Total Games" value={totalGames.toString()} icon="inventory_2" />
        <StatCard label="Games Ranked" value={rankedGames.toString()} icon="military_tech" />
        <StatCard label="Rankers" value={uniqueRankers.size.toString()} icon="group" />
      </div>

      {games && games.length > 0 ? (() => {
        const chartGames = games.map((g) => {
          const entry = avgScoreMap.get(g.bgg_id);
          return {
            name: g.name,
            bggId: g.bgg_id,
            ourScore: entry ? entry.total / entry.count : null,
            yourScore: yourScoreMap.get(g.bgg_id) ?? null,
            bggRating: g.bgg_rating ? Number(g.bgg_rating) : null,
            bggWeight: g.bgg_weight ? Number(g.bgg_weight) : null,
          };
        });
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
        const profileNameMap = new Map<string, string>();
        for (const p of profiles ?? []) {
          profileNameMap.set(p.id, p.display_name);
        }
        const gameScoresMap = new Map<number, { score: number; displayName: string }[]>();
        for (const p of filteredPlacements) {
          if (p.score == null) continue;
          const arr = gameScoresMap.get(p.bgg_id) ?? [];
          arr.push({
            score: p.score,
            displayName: profileNameMap.get(p.user_id) ?? "Unknown",
          });
          gameScoresMap.set(p.bgg_id, arr);
        }
        const gameSnapshotMap = new Map<number, { userId: string | null; displayName: string; score: number; snapshotAt: string }[]>();
        for (const s of snapshots ?? []) {
          if (!gameBggIds.has(s.bgg_id)) continue;
          const arr = gameSnapshotMap.get(s.bgg_id) ?? [];
          arr.push({
            userId: s.user_id ?? null,
            displayName: s.user_id ? (profileNameMap.get(s.user_id) ?? "Unknown") : "Community Avg",
            score: Number(s.score),
            snapshotAt: s.snapshot_at,
          });
          gameSnapshotMap.set(s.bgg_id, arr);
        }
        const distributionGames = games.map((g) => ({
          name: g.name,
          bggId: g.bgg_id,
          bggRating: g.bgg_rating ? Number(g.bgg_rating) : null,
          thumbnailUrl: g.thumbnail_url ?? null,
          scores: gameScoresMap.get(g.bgg_id) ?? [],
          yourScore: yourScoreMap.get(g.bgg_id) ?? null,
          scoreHistory: gameSnapshotMap.get(g.bgg_id) ?? [],
        }));
        return (
        <>
        <div className="grid gap-gutter lg:grid-cols-2 [&>section]:flex [&>section]:flex-col">
          <ComplexityChart games={chartGames} />
          <DistributionChart games={distributionGames} currentUserId={user?.id ?? null} />
        </div>
        <section className="flex flex-col gap-stack-compact">
          <h2 className="font-display text-headline-lg text-on-surface">
            Games
          </h2>
          <div className="glass-card overflow-x-auto rounded-lg p-card-padding">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left">
                  <th className="pb-2 pr-4 font-stat text-stat-label text-on-surface-variant">Game</th>
                  <th className="pb-2 pr-4 text-right font-stat text-stat-label text-on-surface-variant">Yours</th>
                  <th className="pb-2 pr-4 text-right font-stat text-stat-label text-on-surface-variant">Ours</th>
                  <th className="pb-2 pr-4 text-right font-stat text-stat-label text-on-surface-variant">BGG</th>
                  <th className="pb-2 text-right font-stat text-stat-label text-on-surface-variant">Weight</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((game) => (
                  <tr
                    key={game.bgg_id}
                    className="border-b border-outline-variant last:border-b-0"
                  >
                    <td className="py-2 pr-4 font-medium text-on-surface">
                      <a
                        href={`/games/${game.bgg_id}`}
                        className="transition-colors hover:text-primary"
                      >
                        {game.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-right font-stat text-stat-label text-secondary">
                      {yourScoreMap.has(game.bgg_id)
                        ? yourScoreMap.get(game.bgg_id)!.toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-2 pr-4 text-right font-stat text-stat-label text-primary">
                      {avgScoreMap.has(game.bgg_id)
                        ? (
                            avgScoreMap.get(game.bgg_id)!.total /
                            avgScoreMap.get(game.bgg_id)!.count
                          ).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-2 pr-4 text-right font-stat text-stat-label text-on-surface-variant">
                      {game.bgg_rating
                        ? Number(game.bgg_rating).toFixed(1)
                        : "-"}
                    </td>
                    <td className="py-2 text-right font-stat text-stat-label text-on-surface-variant">
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
        <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
          <span className="material-symbols-outlined text-[40px] text-outline">query_stats</span>
          <p className="text-on-surface-variant">
            No games yet. Add some games to see statistics here.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass-card flex flex-col gap-1 rounded-lg p-card-padding">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined stat-icon text-[18px]">{icon}</span>
        <span className="font-stat text-stat-label text-on-surface-variant">{label}</span>
      </div>
      <div className="font-stat text-2xl text-on-surface">
        {value}
      </div>
    </div>
  );
}
