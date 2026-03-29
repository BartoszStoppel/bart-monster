"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import type { BoardGame } from "@/types/database";
import type { PickerMode } from "@/lib/picker-utils";
import { calculateWeights, weightedRandomIndex } from "@/lib/picker-utils";
import { SpinnerWheel } from "./spinner-wheel";
import type { WheelSegment } from "./spinner-wheel";
import { TierRangeSelector } from "./tier-range-selector";

type CategoryFilter = "all" | "board" | "party";

const TIERS = ["S", "A", "B", "C", "D", "F"] as const;

const MODE_OPTIONS: { value: PickerMode; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "favor-easy", label: "Favor Easy" },
  { value: "favor-hard", label: "Favor Hard" },
  { value: "player-ranked", label: "Player Ranked" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "board", label: "Board" },
  { value: "party", label: "Party" },
];

function usePillIndicator<T extends string>(active: T) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const btn = btnRefs.current.get(active);
    if (container && btn) {
      const cr = container.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      setPill({ left: br.left - cr.left, width: br.width });
    }
  }, [active]);

  useEffect(() => {
    measure();
  }, [measure]);

  const setRef = useCallback((key: T, el: HTMLButtonElement | null) => {
    if (el) btnRefs.current.set(key, el);
  }, []);

  return { containerRef, setRef, pill };
}

interface PickerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface GamePickerProps {
  profiles: PickerProfile[];
  games: BoardGame[];
  ownershipMap: Record<string, number[]>;
  userScoreMap: Record<string, Record<string, number>>;
  gameTiers: Record<string, string[]>;
  currentUserId: string | null;
}

export function GamePicker({
  profiles,
  games,
  ownershipMap,
  userScoreMap,
  gameTiers,
  currentUserId,
}: GamePickerProps) {
  const [supplierId, setSupplierId] = useState<string | null>(currentUserId);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    () => new Set(currentUserId ? [currentUserId] : [])
  );
  const [mode, setMode] = useState<PickerMode>("random");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [aggression, setAggression] = useState(50);
  const [minTime, setMinTime] = useState<number | null>(null);
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(
    () => new Set(TIERS)
  );
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [result, setResult] = useState<BoardGame | null>(null);

  const {
    containerRef: modeContainerRef,
    setRef: setModeRef,
    pill: modePillStyle,
  } = usePillIndicator(mode);
  const {
    containerRef: catContainerRef,
    setRef: setCatRef,
    pill: catPillStyle,
  } = usePillIndicator(category);

  const togglePlayer = useCallback((id: string) => {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setResult(null);
  }, []);

  const pool = useMemo(() => {
    if (!supplierId) return [];
    const ownedIds = new Set(ownershipMap[supplierId] ?? []);
    let filtered = games.filter((g) => ownedIds.has(g.bgg_id));
    if (category !== "all") {
      filtered = filtered.filter((g) => g.category === category);
    }
    const playerCount = selectedPlayers.size;
    if (playerCount > 0) {
      filtered = filtered.filter((g) => {
        if (g.min_players == null || g.max_players == null) return true;
        return playerCount >= g.min_players && playerCount <= g.max_players;
      });
    }
    if (minTime != null || maxTime != null) {
      filtered = filtered.filter((g) => {
        if (g.playing_time == null) return false;
        if (minTime != null && g.playing_time < minTime) return false;
        if (maxTime != null && g.playing_time > maxTime) return false;
        return true;
      });
    }
    // Tier filter: include game if ANY user placed it in a selected tier
    if (selectedTiers.size < TIERS.length) {
      filtered = filtered.filter((g) => {
        const tiers = gameTiers[String(g.bgg_id)];
        if (!tiers) return true; // unrated games pass through
        return tiers.some((t) => selectedTiers.has(t));
      });
    }
    return filtered;
  }, [supplierId, ownershipMap, games, category, selectedPlayers.size, minTime, maxTime, selectedTiers, gameTiers]);

  const playerIds = useMemo(() => [...selectedPlayers], [selectedPlayers]);

  const weights = useMemo(
    () => calculateWeights(pool, mode, userScoreMap, playerIds),
    [pool, mode, userScoreMap, playerIds]
  );

  const adjustedWeights = useMemo(() => {
    if (mode === "random") return weights;
    const exp = 0.1 + (aggression / 100) * 2.9;
    return weights.map((w) => Math.pow(w, exp));
  }, [weights, mode, aggression]);

  const segments: WheelSegment[] = useMemo(
    () => pool.map((g, i) => ({
      label: g.name,
      weight: adjustedWeights[i],
      imageUrl: g.thumbnail_url ?? g.image_url ?? undefined,
    })),
    [pool, adjustedWeights]
  );

  const handleSpin = useCallback(() => {
    if (pool.length === 0 || spinning) return;
    setResult(null);
    const idx = weightedRandomIndex(adjustedWeights);
    setTargetIndex(idx);
    setSpinning(true);
  }, [pool, adjustedWeights, spinning]);

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
    if (targetIndex != null && pool[targetIndex]) {
      setResult(pool[targetIndex]);
    }
  }, [targetIndex, pool]);

  const supplierProfile = profiles.find((p) => p.id === supplierId);

  return (
    <div className="space-y-6">
      {/* Supplier + Category row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="supplier-select"
            className="mb-1 block text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Supplier
          </label>
          <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
            Whose house are you at?
          </p>
          <select
            id="supplier-select"
            value={supplierId ?? ""}
            onChange={(e) => {
              setSupplierId(e.target.value || null);
              setResult(null);
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Select a player...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({(ownershipMap[p.id] ?? []).length} games)
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Category
          </div>
          <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
            {supplierId
              ? `${pool.length} ${pool.length === 1 ? "game" : "games"} from ${supplierProfile?.display_name ?? "supplier"}`
              : "Select a supplier"}
          </p>
          <div
            ref={catContainerRef}
            className="relative inline-flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
          >
            <div
              className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-zinc-700"
              style={{ left: catPillStyle.left, width: catPillStyle.width }}
            />
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                ref={(el) => setCatRef(opt.value, el)}
                onClick={() => {
                  setCategory(opt.value);
                  setResult(null);
                }}
                className={`relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  category === opt.value
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player selection */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Players
        </h2>
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => {
            const selected = selectedPlayers.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-zinc-200 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                }`}
              >
                {p.avatar_url ? (
                  <Image
                    src={p.avatar_url}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      selected
                        ? "bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-300"
                        : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                {p.display_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier + Time row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TierRangeSelector
          selectedTiers={selectedTiers}
          onToggle={(tier) => {
            setSelectedTiers((prev) => {
              const next = new Set(prev);
              if (next.has(tier)) {
                if (next.size > 1) next.delete(tier);
              } else {
                next.add(tier);
              }
              return next;
            });
            setResult(null);
          }}
          onReset={() => {
            setSelectedTiers(new Set(TIERS));
            setResult(null);
          }}
        />
        <div>
          <div className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
            Play Time (minutes)
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="Min"
              value={minTime ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                setMinTime(val);
                setResult(null);
              }}
              className="w-20 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm tabular-nums text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">to</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              value={maxTime ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                setMaxTime(val);
                setResult(null);
              }}
              className="w-20 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm tabular-nums text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* Weighting + Aggression row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
            Weighting
          </div>
          <div
            ref={modeContainerRef}
            className="relative inline-flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
          >
            <div
              className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-zinc-700"
              style={{ left: modePillStyle.left, width: modePillStyle.width }}
            />
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                ref={(el) => setModeRef(opt.value, el)}
                onClick={() => {
                  setMode(opt.value);
                  setResult(null);
                }}
                className={`relative z-10 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  mode === opt.value
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {mode !== "random" && (
          <div>
            <div className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
              Aggression
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Equal
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={aggression}
                onChange={(e) => {
                  setAggression(Number(e.target.value));
                  setResult(null);
                }}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-600 dark:bg-zinc-700"
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Aggressive
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Spinner */}
      <SpinnerWheel
        segments={segments}
        spinning={spinning}
        targetIndex={targetIndex}
        onSpinComplete={handleSpinComplete}
      />

      {/* Spin button */}
      <div className="text-center">
        <button
          onClick={handleSpin}
          disabled={spinning || pool.length === 0}
          className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {spinning ? "Spinning..." : result ? "Spin Again" : "Spin!"}
        </button>
      </div>

      {/* Result popup */}
      {result && !spinning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
          onClick={() => setResult(null)}
        >
          <div
            className="animate-pop-in mx-4 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {(result.image_url || result.thumbnail_url) && (
              <div className="relative mx-auto mb-4 aspect-square w-48 overflow-hidden rounded-xl">
                <Image
                  src={result.image_url || result.thumbnail_url || ""}
                  alt={result.name}
                  fill
                  className="object-contain"
                  sizes="192px"
                />
              </div>
            )}
            <h3 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {result.name}
            </h3>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              {result.min_players && result.max_players && (
                <span>
                  {result.min_players === result.max_players
                    ? `${result.min_players}`
                    : `${result.min_players}-${result.max_players}`}{" "}
                  players
                </span>
              )}
              {result.playing_time && <span>{result.playing_time} min</span>}
              {result.bgg_weight && (
                <span>Weight {result.bgg_weight.toFixed(1)}</span>
              )}
            </div>
            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
