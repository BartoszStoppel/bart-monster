"use client";

import { useState, useMemo } from "react";

interface GameScore {
  name: string;
  bggId: number;
  ourScore: number | null;
  yourScore: number | null;
  bggRating: number | null;
  bggWeight: number | null;
}

interface ComplexityChartProps {
  games: GameScore[];
}

const W = 400;
const H = 240;
const PAD = { top: 24, right: 16, bottom: 32, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const Y_MIN = 1;
const Y_MAX = 10;
const Y_TICKS = [2, 4, 6, 8, 10];

const DOT_R = 2;
const DOT_R_HOVER = 3.5;
const LINE_W = 1;

function yPos(v: number) {
  return PAD.top + PLOT_H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}

/** Generate nice tick values with adaptive step size. */
function generateXTicks(xMin: number, xMax: number): number[] {
  const range = xMax - xMin;
  let step: number;
  if (range <= 0.5) step = 0.1;
  else if (range <= 1.5) step = 0.25;
  else if (range <= 3) step = 0.5;
  else step = 1;

  const ticks: number[] = [];
  const start = Math.ceil(xMin / step) * step;
  for (let v = start; v <= xMax + step * 0.01; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

/**
 * Gaussian-weighted moving average.
 * Evaluates a smooth curve by computing weighted means using a Gaussian kernel.
 */
function gaussianSmooth(
  xs: number[],
  ys: number[],
  steps: number,
  sigma: number
): { x: number; y: number }[] {
  const n = xs.length;
  if (n < 2) return [];

  const xLo = Math.min(...xs);
  const xHi = Math.max(...xs);

  const result: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const xEval = xLo + (i / steps) * (xHi - xLo);
    let sumW = 0;
    let sumWy = 0;

    for (let j = 0; j < n; j++) {
      const d = (xs[j] - xEval) / sigma;
      const w = Math.exp(-0.5 * d * d);
      sumW += w;
      sumWy += w * ys[j];
    }

    const yEval = sumW > 0 ? sumWy / sumW : 0;
    result.push({ x: xEval, y: Math.max(Y_MIN, Math.min(Y_MAX, yEval)) });
  }
  return result;
}

/** Build a smooth SVG cubic bezier path through sampled points. */
function buildSmoothPath(
  points: { x: number; y: number }[],
  toX: (v: number) => number
): string {
  if (points.length < 2) return "";
  const pts = points.map((p) => ({ x: toX(p.x), y: yPos(p.y) }));

  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Scatter plot: X = BGG complexity (dynamic), Y = score (1-10).
 * Three series: Yours (green), Ours (blue), BGG (orange).
 * Clickable legend to toggle series visibility.
 */
export function ComplexityChart({ games }: ComplexityChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [visible, setVisible] = useState({ yours: true, ours: true, bgg: true });

  const ourGames = games.filter(
    (g) => g.ourScore != null && g.bggWeight != null && g.bggWeight > 0
  );
  const yourGames = games.filter(
    (g) => g.yourScore != null && g.bggWeight != null && g.bggWeight > 0
  );
  const bggGames = games.filter(
    (g) => g.bggRating != null && g.bggWeight != null && g.bggWeight > 0
  );

  const weightsKey = [
    ...ourGames.map((g) => g.bggWeight!),
    ...yourGames.map((g) => g.bggWeight!),
    ...bggGames.map((g) => g.bggWeight!),
  ].join(",");

  const { xMin, xMax, xTicks, toX } = useMemo(() => {
    const allWeights = weightsKey.split(",").filter(Boolean).map(Number);
    if (allWeights.length === 0) {
      return {
        xMin: 1,
        xMax: 5,
        xTicks: [1, 2, 3, 4, 5],
        toX: (v: number) => PAD.left + ((v - 1) / 4) * PLOT_W,
      };
    }
    const rawMin = Math.min(...allWeights);
    const rawMax = Math.max(...allWeights);
    const range = rawMax - rawMin;
    const padding = range * 0.01;
    const min = Math.max(0, Math.floor((rawMin - padding) * 10) / 10);
    const max = Math.ceil((rawMax + padding) * 10) / 10;
    const ticks = generateXTicks(min, max);
    const fn = (v: number) =>
      PAD.left + ((v - min) / (max - min)) * PLOT_W;
    return { xMin: min, xMax: max, xTicks: ticks, toX: fn };
  }, [weightsKey]);

  if (ourGames.length === 0 && bggGames.length === 0) return null;

  const steps = 80;
  const range = xMax - xMin || 1;
  const sigma = range * 0.4;

  const ourTrend = buildSmoothPath(
    gaussianSmooth(ourGames.map((g) => g.bggWeight!), ourGames.map((g) => g.ourScore!), steps, sigma),
    toX
  );
  const yourTrend = buildSmoothPath(
    gaussianSmooth(yourGames.map((g) => g.bggWeight!), yourGames.map((g) => g.yourScore!), steps, sigma),
    toX
  );
  const bggTrend = buildSmoothPath(
    gaussianSmooth(bggGames.map((g) => g.bggWeight!), bggGames.map((g) => g.bggRating!), steps, sigma),
    toX
  );

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Complexity vs Score
      </h2>
      <div className="flex flex-1 flex-col justify-center rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          onMouseLeave={() => setHovered(null)}
        >
          {/* Grid */}
          {Y_TICKS.map((t) => (
            <line
              key={`y-${t}`}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yPos(t)}
              y2={yPos(t)}
              className="stroke-zinc-100 dark:stroke-zinc-800"
              strokeWidth={0.3}
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`x-${t}`}
              x1={toX(t)}
              x2={toX(t)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-zinc-100 dark:stroke-zinc-800"
              strokeWidth={0.3}
            />
          ))}

          {/* Axis labels */}
          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={toX(t)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              className="fill-zinc-400 text-[8px]"
            >
              {t % 1 === 0 ? t : t.toFixed(1)}
            </text>
          ))}
          {Y_TICKS.map((t) => (
            <text
              key={`yl-${t}`}
              x={PAD.left - 5}
              y={yPos(t) + 3}
              textAnchor="end"
              className="fill-zinc-400 text-[8px]"
            >
              {t}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 2}
            textAnchor="middle"
            className="fill-zinc-300 text-[8px] dark:fill-zinc-600"
          >
            BGG Complexity
          </text>
          <text
            x={6}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            className="fill-zinc-300 text-[8px] dark:fill-zinc-600"
            transform={`rotate(-90, 6, ${PAD.top + PLOT_H / 2})`}
          >
            Score
          </text>

          {/* Trend lines */}
          {visible.bgg && bggTrend && (
            <path
              d={bggTrend}
              fill="none"
              className="stroke-orange-400 dark:stroke-orange-500"
              strokeWidth={LINE_W}
              opacity={0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {visible.ours && ourTrend && (
            <path
              d={ourTrend}
              fill="none"
              className="stroke-blue-400 dark:stroke-blue-500"
              strokeWidth={LINE_W}
              opacity={0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {visible.yours && yourTrend && (
            <path
              d={yourTrend}
              fill="none"
              className="stroke-green-400 dark:stroke-green-500"
              strokeWidth={LINE_W}
              opacity={0.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* BGG dots (orange) */}
          {visible.bgg && bggGames.map((g) => {
            const cx = toX(g.bggWeight!);
            const cy = yPos(g.bggRating!);
            const key = `bgg-${g.bggId}`;
            const active = hovered === key;
            return (
              <a key={key} href={`/games/${g.bggId}`}>
                <circle cx={cx} cy={cy} r={8} fill="transparent"
                  onMouseEnter={() => setHovered(key)}
                  onTouchStart={() => setHovered(key)}
                />
                <circle cx={cx} cy={cy}
                  r={active ? DOT_R_HOVER : DOT_R}
                  className="fill-orange-500 dark:fill-orange-400"
                  opacity={active ? 1 : 0.7}
                />
              </a>
            );
          })}

          {/* Our dots (blue) */}
          {visible.ours && ourGames.map((g) => {
            const cx = toX(g.bggWeight!);
            const cy = yPos(g.ourScore!);
            const key = `our-${g.bggId}`;
            const active = hovered === key;
            return (
              <a key={key} href={`/games/${g.bggId}`}>
                <circle cx={cx} cy={cy} r={8} fill="transparent"
                  onMouseEnter={() => setHovered(key)}
                  onTouchStart={() => setHovered(key)}
                />
                <circle cx={cx} cy={cy}
                  r={active ? DOT_R_HOVER : DOT_R}
                  className="fill-blue-500 dark:fill-blue-400"
                  opacity={active ? 1 : 0.75}
                />
              </a>
            );
          })}

          {/* Your dots (green) */}
          {visible.yours && yourGames.map((g) => {
            const cx = toX(g.bggWeight!);
            const cy = yPos(g.yourScore!);
            const key = `your-${g.bggId}`;
            const active = hovered === key;
            return (
              <a key={key} href={`/games/${g.bggId}`}>
                <circle cx={cx} cy={cy} r={8} fill="transparent"
                  onMouseEnter={() => setHovered(key)}
                  onTouchStart={() => setHovered(key)}
                />
                <circle cx={cx} cy={cy}
                  r={active ? DOT_R_HOVER : DOT_R}
                  className="fill-green-500 dark:fill-green-400"
                  opacity={active ? 1 : 0.8}
                />
              </a>
            );
          })}

          {/* Tooltip */}
          {hovered && (() => {
            const [series, idStr] = hovered.split("-");
            const id = Number(idStr);
            const g = games.find((game) => game.bggId === id);
            if (!g) return null;
            let cx = 0;
            let cy = 0;
            if (series === "bgg" && g.bggWeight && g.bggRating) {
              cx = toX(g.bggWeight); cy = yPos(g.bggRating);
            } else if (series === "our" && g.bggWeight && g.ourScore) {
              cx = toX(g.bggWeight); cy = yPos(g.ourScore);
            } else if (series === "your" && g.bggWeight && g.yourScore) {
              cx = toX(g.bggWeight); cy = yPos(g.yourScore);
            } else {
              return null;
            }
            const label = g.name.length > 24 ? g.name.slice(0, 22) + "..." : g.name;
            const labelW = label.length * 4.2 + 10;
            const right = cx < W / 2;
            const tx = right ? cx + 6 : cx - 6 - labelW;
            return (
              <g pointerEvents="none">
                <rect
                  x={tx} y={cy - 8} width={labelW} height={16} rx={2}
                  className="fill-zinc-800/90 dark:fill-zinc-200/90"
                />
                <text x={tx + 5} y={cy + 2}
                  className="fill-white text-[7px] dark:fill-zinc-900"
                >
                  {label}
                </text>
              </g>
            );
          })()}

          {/* Legend (clickable toggles) */}
          <g
            className="cursor-pointer"
            onClick={() => setVisible((v) => ({ ...v, yours: !v.yours }))}
          >
            <circle cx={W - PAD.right - 108} cy={PAD.top - 10} r={2}
              className="fill-green-500" opacity={visible.yours ? 1 : 0.25}
            />
            <text x={W - PAD.right - 103} y={PAD.top - 7.5}
              className="fill-zinc-400 text-[7px]" opacity={visible.yours ? 1 : 0.35}
            >Yours</text>
          </g>
          <g
            className="cursor-pointer"
            onClick={() => setVisible((v) => ({ ...v, ours: !v.ours }))}
          >
            <circle cx={W - PAD.right - 74} cy={PAD.top - 10} r={2}
              className="fill-blue-500" opacity={visible.ours ? 1 : 0.25}
            />
            <text x={W - PAD.right - 69} y={PAD.top - 7.5}
              className="fill-zinc-400 text-[7px]" opacity={visible.ours ? 1 : 0.35}
            >Ours</text>
          </g>
          <g
            className="cursor-pointer"
            onClick={() => setVisible((v) => ({ ...v, bgg: !v.bgg }))}
          >
            <circle cx={W - PAD.right - 44} cy={PAD.top - 10} r={2}
              className="fill-orange-500" opacity={visible.bgg ? 1 : 0.25}
            />
            <text x={W - PAD.right - 39} y={PAD.top - 7.5}
              className="fill-zinc-400 text-[7px]" opacity={visible.bgg ? 1 : 0.35}
            >BGG</text>
          </g>
        </svg>
      </div>
    </section>
  );
}
