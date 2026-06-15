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
 * Side-by-side horizontal bar chart: your score (slime), our score (amber), BGG rating (stone).
 * Each game gets one row with overlapping bars for easy comparison.
 */
export function ScoreComparisonChart({ games }: ScoreChartProps) {
  const scored = games.filter((g) => g.ourScore != null);
  if (scored.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 font-display text-headline-lg text-on-surface">
        Yours vs Ours vs BGG
      </h2>
      <div className="glass-card rounded-lg p-4">
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
                    className="truncate text-sm font-medium text-on-surface hover:text-primary"
                  >
                    {game.name}
                  </a>
                  <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                    {yours > 0 && (
                      <>
                        <span className="font-semibold text-secondary">
                          {yours.toFixed(1)}
                        </span>
                        <span className="text-on-surface-variant/70">/</span>
                      </>
                    )}
                    <span className="font-semibold text-primary">
                      {ours.toFixed(1)}
                    </span>
                    <span className="text-on-surface-variant/70">/</span>
                    <span className="text-on-surface-variant">
                      {bgg ? bgg.toFixed(1) : "-"}
                    </span>
                    {bgg > 0 && (
                      <span
                        className={`text-[10px] font-medium ${
                          diff > 0.5
                            ? "text-secondary"
                            : diff < -0.5
                              ? "text-error"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-5 rounded bg-surface-container-highest">
                  {bgg > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-outline/40"
                      style={{ width: `${(bgg / 10) * 100}%` }}
                    />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-primary-container"
                    style={{ width: `${(ours / 10) * 100}%`, opacity: 0.6 }}
                  />
                  {yours > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-secondary-container"
                      style={{ width: `${(yours / 10) * 100}%`, opacity: 0.8 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded bg-secondary-container opacity-80" />
            <span>Yours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded bg-primary-container opacity-60" />
            <span>Ours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded bg-outline/40" />
            <span>BGG</span>
          </div>
        </div>
      </div>
    </section>
  );
}
