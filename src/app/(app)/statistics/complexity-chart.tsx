"use client";

import { useState } from "react";

interface GameScore {
  name: string;
  bggId: number;
  ourScore: number | null;
  bggRating: number | null;
  bggWeight: number | null;
}

interface ComplexityChartProps {
  games: GameScore[];
}

const W = 400;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 32, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const X_MIN = 1;
const X_MAX = 5;
const Y_MIN = 1;
const Y_MAX = 10;
const X_TICKS = [1, 2, 3, 4, 5];
const Y_TICKS = [2, 4, 6, 8, 10];

function xPos(v: number) {
  return PAD.left + ((v - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
}
function yPos(v: number) {
  return PAD.top + PLOT_H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}

/**
 * Interactive SVG scatter plot: X = BGG complexity (1–5), Y = our score (1–10).
 * Hovering a dot shows the game name as a floating label.
 */
export function ComplexityChart({ games }: ComplexityChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const plotGames = games.filter(
    (g) => g.ourScore != null && g.bggWeight != null && g.bggWeight > 0
  );
  if (plotGames.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Complexity vs Our Score
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          onMouseLeave={() => setHovered(null)}
        >
          {/* Grid lines */}
          {Y_TICKS.map((t) => (
            <line
              key={`y-${t}`}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yPos(t)}
              y2={yPos(t)}
              className="stroke-zinc-200 dark:stroke-zinc-700"
              strokeWidth={0.5}
            />
          ))}
          {X_TICKS.map((t) => (
            <line
              key={`x-${t}`}
              x1={xPos(t)}
              x2={xPos(t)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className="stroke-zinc-200 dark:stroke-zinc-700"
              strokeWidth={0.5}
            />
          ))}

          {/* Axis labels */}
          {X_TICKS.map((t) => (
            <text
              key={`xl-${t}`}
              x={xPos(t)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              className="fill-zinc-400 text-[10px]"
            >
              {t}
            </text>
          ))}
          {Y_TICKS.map((t) => (
            <text
              key={`yl-${t}`}
              x={PAD.left - 8}
              y={yPos(t) + 3}
              textAnchor="end"
              className="fill-zinc-400 text-[10px]"
            >
              {t}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 2}
            textAnchor="middle"
            className="fill-zinc-400 text-[10px]"
          >
            BGG Complexity
          </text>
          <text
            x={8}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            className="fill-zinc-400 text-[10px]"
            transform={`rotate(-90, 8, ${PAD.top + PLOT_H / 2})`}
          >
            Our Score
          </text>

          {/* Data points */}
          {plotGames.map((g) => {
            const cx = xPos(g.bggWeight!);
            const cy = yPos(g.ourScore!);
            const isHovered = hovered === g.bggId;
            const labelRight = cx < W / 2;

            return (
              <g key={g.bggId}>
                <a href={`/games/${g.bggId}`}>
                  {/* Larger invisible hit target */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={14}
                    fill="transparent"
                    onMouseEnter={() => setHovered(g.bggId)}
                    onTouchStart={() => setHovered(g.bggId)}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 8 : 6}
                    className={
                      isHovered
                        ? "fill-blue-600 stroke-white dark:stroke-zinc-900"
                        : "fill-blue-500 stroke-white dark:stroke-zinc-900"
                    }
                    strokeWidth={1.5}
                    opacity={isHovered ? 1 : 0.75}
                    style={{ transition: "r 0.15s, opacity 0.15s" }}
                  />
                </a>
                {isHovered && (
                  <g pointerEvents="none">
                    <rect
                      x={labelRight ? cx + 12 : cx - 12}
                      y={cy - 12}
                      width={Math.min(g.name.length * 5.5 + 16, 180)}
                      height={24}
                      rx={4}
                      className="fill-zinc-800 dark:fill-zinc-200"
                      transform={
                        labelRight
                          ? undefined
                          : `translate(${-Math.min(g.name.length * 5.5 + 16, 180)}, 0)`
                      }
                    />
                    <text
                      x={labelRight ? cx + 20 : cx - 20}
                      y={cy + 1}
                      textAnchor={labelRight ? "start" : "end"}
                      className="fill-white text-[10px] font-medium dark:fill-zinc-900"
                    >
                      {g.name.length > 28
                        ? g.name.slice(0, 26) + "..."
                        : g.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-center text-[10px] text-zinc-400">
          Hover over a dot to see the game name
        </p>
      </div>
    </section>
  );
}
