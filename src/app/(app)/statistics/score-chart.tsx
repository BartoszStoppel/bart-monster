interface GameScore {
  name: string;
  bggId: number;
  ourScore: number | null;
  yourScore: number | null;
  bggRating: number | null;
  bggWeight?: number | null;
}

interface ScoreChartProps {
  games: GameScore[];
}

/**
 * Side-by-side horizontal bar chart: your score (green), our score (blue), BGG rating (amber).
 * Each game gets one row with overlapping bars for easy comparison.
 */
export function ScoreComparisonChart({ games }: ScoreChartProps) {
  const scored = games.filter((g) => g.ourScore != null);
  if (scored.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Yours vs Ours vs BGG
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/5">
        <div className="space-y-4">
          {scored.map((game) => {
            const ours = game.ourScore ?? 0;
            const yours = game.yourScore ?? 0;
            const bgg = game.bggRating ?? 0;
            const diff = ours - bgg;
            return (
              <div key={game.bggId} className="group">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <a
                    href={`/games/${game.bggId}`}
                    className="truncate text-sm font-medium text-zinc-900 hover:text-cyan-600 dark:text-zinc-100 dark:hover:text-cyan-400"
                  >
                    {game.name}
                  </a>
                  <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                    {yours > 0 && (
                      <>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {yours.toFixed(1)}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-600">/</span>
                      </>
                    )}
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {ours.toFixed(1)}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-600">/</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {bgg ? bgg.toFixed(1) : "-"}
                    </span>
                    {bgg > 0 && (
                      <span
                        className={`text-[10px] font-medium ${
                          diff > 0.5
                            ? "text-green-600 dark:text-green-400"
                            : diff < -0.5
                              ? "text-red-500 dark:text-red-400"
                              : "text-zinc-400"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-5 rounded bg-zinc-100 dark:bg-white/5">
                  {bgg > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-amber-400/40 dark:bg-amber-500/25"
                      style={{ width: `${(bgg / 10) * 100}%` }}
                    />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-cyan-500"
                    style={{ width: `${(ours / 10) * 100}%`, opacity: 0.6 }}
                  />
                  {yours > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-green-500"
                      style={{ width: `${(yours / 10) * 100}%`, opacity: 0.8 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded bg-green-500 opacity-80" />
            <span>Yours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded bg-cyan-500 opacity-60" />
            <span>Ours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded bg-amber-400/40 dark:bg-amber-500/25" />
            <span>BGG</span>
          </div>
        </div>
      </div>
    </section>
  );
}
