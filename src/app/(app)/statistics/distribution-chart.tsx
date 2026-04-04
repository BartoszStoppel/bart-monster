"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  ScoreHistoryChart,
  type ScoreSnapshot,
} from "./score-history-chart";

interface DistributionGame {
  name: string;
  bggId: number;
  bggRating: number | null;
  thumbnailUrl: string | null;
  scores: number[];
  yourScore: number | null;
  scoreHistory: ScoreSnapshot[];
}

interface DistributionChartProps {
  games: DistributionGame[];
  currentUserId: string | null;
}

const W = 400;
const H = 240;
const PAD = { top: 24, right: 16, bottom: 32, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const X_MIN = 1;
const X_MAX = 10;
const X_TICKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KDE_STEPS = 100;
const BANDWIDTH = 0.6;

function toX(v: number): number {
  return PAD.left + ((v - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}

/**
 * Gaussian kernel density estimation.
 * Returns density values sampled at evenly spaced points across the score range.
 */
function kde(scores: number[], steps: number, bandwidth: number): { x: number; density: number }[] {
  const result: { x: number; density: number }[] = [];
  const n = scores.length;
  if (n === 0) return result;

  for (let i = 0; i <= steps; i++) {
    const x = X_MIN + (i / steps) * (X_MAX - X_MIN);
    let sum = 0;
    for (const s of scores) {
      const z = (x - s) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    const density = sum / (n * bandwidth * Math.sqrt(2 * Math.PI));
    result.push({ x, density });
  }
  return result;
}

/**
 * Build a mirrored violin SVG path from KDE density values.
 * The violin is centered vertically in the plot area.
 */
function buildViolinPath(points: { x: number; density: number }[], maxDensity: number): string {
  if (points.length < 2 || maxDensity === 0) return "";

  const centerY = PAD.top + PLOT_H / 2;
  const maxHalf = PLOT_H / 2 - 4;

  const top: string[] = [];
  const bottom: string[] = [];

  for (const p of points) {
    const px = toX(p.x);
    const offset = (p.density / maxDensity) * maxHalf;
    top.push(`${px.toFixed(1)},${(centerY - offset).toFixed(1)}`);
    bottom.push(`${px.toFixed(1)},${(centerY + offset).toFixed(1)}`);
  }

  return `M${top[0]} L${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
}

export function DistributionChart({ games, currentUserId }: DistributionChartProps) {
  const sortedGames = useMemo(
    () => [...games].filter((g) => g.scores.length > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [games]
  );

  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (sortedGames.length === 0) return null;
    const mostRated = sortedGames.reduce((best, g) =>
      g.scores.length > best.scores.length ? g : best
    );
    return mostRated.bggId;
  });

  const selected = sortedGames.find((g) => g.bggId === selectedId) ?? null;

  const { points, maxDensity } = useMemo(() => {
    if (!selected) return { points: [], maxDensity: 0 };
    const pts = kde(selected.scores, KDE_STEPS, BANDWIDTH);
    const peak = Math.max(...pts.map((p) => p.density));
    return { points: pts, maxDensity: peak };
  }, [selected]);

  const violinPath = useMemo(
    () => buildViolinPath(points, maxDensity),
    [points, maxDensity]
  );

  const bggLineX = selected?.bggRating ? toX(selected.bggRating) : null;
  const communityAvg = selected && selected.scores.length > 0
    ? selected.scores.reduce((a, b) => a + b, 0) / selected.scores.length
    : null;
  const centerY = PAD.top + PLOT_H / 2;


  if (sortedGames.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Score Distribution
      </h2>
      <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center gap-2">
          {selected?.thumbnailUrl && (
            <Image
              src={selected.thumbnailUrl}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-700"
            />
          )}
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value) || null)}
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {sortedGames.map((g) => (
              <option key={g.bggId} value={g.bggId}>
                {g.name} ({g.scores.length} ratings)
              </option>
            ))}
          </select>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
        >
          {/* Grid lines */}
          {X_TICKS.map((t) => (
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
          {/* Center line */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={centerY}
            y2={centerY}
            className="stroke-zinc-200 dark:stroke-zinc-700"
            strokeWidth={0.3}
          />

          {/* X-axis labels */}
          {X_TICKS.map((t) => (
            <text
              key={`xl-${t}`}
              x={toX(t)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              className="fill-zinc-400 text-[8px]"
            >
              {t}
            </text>
          ))}

          {/* Violin shape */}
          {violinPath && (
            <path
              d={violinPath}
              className="fill-blue-500/30 stroke-blue-500 dark:fill-blue-400/30 dark:stroke-blue-400"
              strokeWidth={1}
            />
          )}

          {/* Individual score dots */}
          {selected?.scores.map((score, i) => (
            <circle
              key={i}
              cx={toX(score)}
              cy={centerY}
              r={2.5}
              className="fill-blue-600 dark:fill-blue-300"
              opacity={0.6}
            />
          ))}

          {/* Your score indicator */}
          {selected?.yourScore != null && (
            <>
              <line
                x1={toX(selected.yourScore)}
                x2={toX(selected.yourScore)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                className="stroke-green-500 dark:stroke-green-400"
                strokeWidth={1}
              />
              <circle
                cx={toX(selected.yourScore)}
                cy={centerY}
                r={3.5}
                className="fill-green-500 stroke-white dark:fill-green-400 dark:stroke-zinc-900"
                strokeWidth={1}
              />
            </>
          )}

          {/* Community average indicator */}
          {communityAvg != null && (
            <>
              <line
                x1={toX(communityAvg)}
                x2={toX(communityAvg)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                className="stroke-blue-500 dark:stroke-blue-400"
                strokeWidth={1}
              />
            </>
          )}

          {/* BGG rating line */}
          {bggLineX != null && (
            <line
              x1={bggLineX}
              x2={bggLineX}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              className="stroke-orange-500 dark:stroke-orange-400"
              strokeWidth={1}
            />
          )}

          {/* Axis title */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 2}
            textAnchor="middle"
            className="fill-zinc-300 text-[8px] dark:fill-zinc-600"
          >
            Score
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {selected?.yourScore != null && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />
              <span className="text-zinc-500 dark:text-zinc-400">You</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {selected.yourScore.toFixed(1)}
              </span>
            </div>
          )}
          {communityAvg != null && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400" />
              <span className="text-zinc-500 dark:text-zinc-400">Avg</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {communityAvg.toFixed(1)}
              </span>
            </div>
          )}
          {selected?.bggRating != null && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-500 dark:bg-orange-400" />
              <span className="text-zinc-500 dark:text-zinc-400">BGG</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {selected.bggRating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {selected && selected.scoreHistory.length > 0 && (
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <h3 className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Score Over Time
            </h3>
            <ScoreHistoryChart snapshots={selected.scoreHistory} bggRating={selected.bggRating} currentUserId={currentUserId} />
          </div>
        )}
      </div>
    </section>
  );
}
