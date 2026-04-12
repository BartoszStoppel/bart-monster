"use client";

export interface ScoreSnapshot {
  userId: string | null;
  displayName: string;
  score: number;
  snapshotAt: string;
}

interface ScoreHistoryChartProps {
  snapshots: ScoreSnapshot[];
  bggRating: number | null;
  currentUserId: string | null;
}

const W = 400;
const H = 160;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const Y_MIN = 1;
const Y_MAX = 10;

const YOU_COLOR = { light: "#22c55e", dark: "#4ade80" };
const AVG_COLOR = { light: "#06b6d4", dark: "#22d3ee" };
const BGG_COLOR = { light: "#f97316", dark: "#fb923c" };

function toY(score: number): number {
  return PAD.top + PLOT_H - ((score - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

interface Point {
  date: number;
  score: number;
  iso: string;
}

interface LineSeries {
  label: string;
  color: { light: string; dark: string };
  points: Point[];
}

export function ScoreHistoryChart({ snapshots, bggRating, currentUserId }: ScoreHistoryChartProps) {
  // Split snapshots into community avg (userId=null) and current user
  const avgPoints: Point[] = [];
  const yourPoints: Point[] = [];

  for (const s of snapshots) {
    const pt: Point = { date: new Date(s.snapshotAt).getTime(), score: s.score, iso: s.snapshotAt };
    if (s.userId === null) {
      avgPoints.push(pt);
    } else if (s.userId === currentUserId) {
      yourPoints.push(pt);
    }
  }

  avgPoints.sort((a, b) => a.date - b.date);
  yourPoints.sort((a, b) => a.date - b.date);

  if (avgPoints.length === 0 && yourPoints.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        No score history yet. History is recorded each time a tier list is saved.
      </p>
    );
  }

  const series: LineSeries[] = [];
  if (yourPoints.length > 0) {
    series.push({ label: "You", color: YOU_COLOR, points: yourPoints });
  }
  if (avgPoints.length > 0) {
    series.push({ label: "Community Avg", color: AVG_COLOR, points: avgPoints });
  }

  // Time range from all points
  const allPoints = [...avgPoints, ...yourPoints];
  let tMin = Math.min(...allPoints.map((p) => p.date));
  let tMax = Math.max(...allPoints.map((p) => p.date));

  if (tMax - tMin < 1000) {
    tMin -= 86400000;
    tMax += 86400000;
  }

  const tRange = tMax - tMin;

  function toX(t: number): number {
    return PAD.left + ((t - tMin) / tRange) * PLOT_W;
  }

  const tickCount = Math.min(5, Math.max(2, Math.ceil(tRange / 86400000 / 7)));
  const dateTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    dateTicks.push(tMin + (i / tickCount) * tRange);
  }

  const yTicks = [2, 4, 6, 8, 10];
  const bggY = bggRating ? toY(bggRating) : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {/* Y grid + labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={toY(v)}
              y2={toY(v)}
              className="stroke-zinc-100 dark:stroke-zinc-800"
              strokeWidth={0.5}
            />
            <text
              x={PAD.left - 6}
              y={toY(v) + 1}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-zinc-400 text-[8px]"
            >
              {v}
            </text>
          </g>
        ))}

        {/* X axis date labels */}
        {dateTicks.map((t, i) => (
          <text
            key={i}
            x={toX(t)}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            className="fill-zinc-400 text-[7px]"
          >
            {formatDate(new Date(t).toISOString())}
          </text>
        ))}

        {/* BGG rating — horizontal dashed line */}
        {bggY != null && (
          <>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={bggY} y2={bggY}
              stroke={BGG_COLOR.light} strokeWidth={1} strokeDasharray="4 3"
              className="dark:hidden"
            />
            <line
              x1={PAD.left} x2={W - PAD.right} y1={bggY} y2={bggY}
              stroke={BGG_COLOR.dark} strokeWidth={1} strokeDasharray="4 3"
              className="hidden dark:block"
            />
          </>
        )}

        {/* Lines + dots per series */}
        {series.map((s, sIdx) => {
          const pts = s.points;
          const pathD = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.date).toFixed(1)},${toY(p.score).toFixed(1)}`)
            .join(" ");

          return (
            <g key={sIdx}>
              {pts.length > 1 && (
                <path
                  d={pathD} fill="none" stroke={s.color.light}
                  strokeWidth={1.5} strokeLinejoin="round" className="dark:hidden"
                />
              )}
              {pts.length > 1 && (
                <path
                  d={pathD} fill="none" stroke={s.color.dark}
                  strokeWidth={1.5} strokeLinejoin="round" className="hidden dark:block"
                />
              )}
              {pts.map((p, i) => (
                <g key={i}>
                  <circle cx={toX(p.date)} cy={toY(p.score)} r={2.5} fill={s.color.light} className="dark:hidden">
                    <title>{`${s.label}: ${p.score.toFixed(1)} — ${formatDate(p.iso)}`}</title>
                  </circle>
                  <circle cx={toX(p.date)} cy={toY(p.score)} r={2.5} fill={s.color.dark} className="hidden dark:block">
                    <title>{`${s.label}: ${p.score.toFixed(1)} — ${formatDate(p.iso)}`}</title>
                  </circle>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full dark:hidden" style={{ backgroundColor: s.color.light }} />
            <span className="hidden h-2 w-2 rounded-full dark:inline-block" style={{ backgroundColor: s.color.dark }} />
            <span className="text-zinc-500 dark:text-zinc-400">{s.label}</span>
          </div>
        ))}
        {bggRating != null && (
          <div className="flex items-center gap-1">
            <svg width="12" height="8" className="dark:hidden">
              <line x1="0" y1="4" x2="12" y2="4" stroke={BGG_COLOR.light} strokeWidth={1.5} strokeDasharray="3 2" />
            </svg>
            <svg width="12" height="8" className="hidden dark:block">
              <line x1="0" y1="4" x2="12" y2="4" stroke={BGG_COLOR.dark} strokeWidth={1.5} strokeDasharray="3 2" />
            </svg>
            <span className="text-zinc-500 dark:text-zinc-400">BGG {bggRating.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
