"use client";

import { useState, useMemo, useCallback } from "react";
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

interface PickerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface Household {
  id: string;
  label: string;
  memberIds: string[];
  gameCount: number;
}

interface GamePickerProps {
  profiles: PickerProfile[];
  games: BoardGame[];
  ownershipMap: Record<string, number[]>;
  userScoreMap: Record<string, Record<string, number>>;
  gameTiers: Record<string, string[]>;
  currentUserId: string | null;
  households: Household[];
}

export function GamePicker({
  profiles,
  games,
  ownershipMap,
  userScoreMap,
  gameTiers,
  currentUserId,
  households,
}: GamePickerProps) {
  const currentHousehold = households.find((h) =>
    h.memberIds.includes(currentUserId ?? "")
  );
  const [supplierId, setSupplierId] = useState<string | null>(
    currentHousehold?.id ?? currentUserId
  );
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

  const supplierHousehold = households.find((h) => h.id === supplierId);

  const pool = useMemo(() => {
    if (!supplierHousehold) return [];
    const ownedIds = new Set(
      supplierHousehold.memberIds.flatMap((mid) => ownershipMap[mid] ?? [])
    );
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
  }, [supplierHousehold, ownershipMap, games, category, selectedPlayers.size, minTime, maxTime, selectedTiers, gameTiers]);

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

  return (
    <div className="flex flex-col gap-gutter">
      {/* Supplier + Category row */}
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
        <div className="glass-card flex flex-col gap-stack-compact rounded-lg p-card-padding">
          <label
            htmlFor="supplier-select"
            className="flex items-center gap-2 font-display text-headline-lg-mobile text-on-surface"
          >
            <span className="material-symbols-outlined stat-icon text-[20px]">home</span>
            Supplier
          </label>
          <p className="font-stat text-caption text-on-surface-variant">
            Whose house are you at?
          </p>
          <select
            id="supplier-select"
            value={supplierId ?? ""}
            onChange={(e) => {
              setSupplierId(e.target.value || null);
              setResult(null);
            }}
            className="carved-input w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select a household...</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label} ({h.gameCount} games)
              </option>
            ))}
          </select>
        </div>
        <div className="glass-card flex flex-col gap-stack-compact rounded-lg p-card-padding">
          <div className="flex items-center gap-2 font-display text-headline-lg-mobile text-on-surface">
            <span className="material-symbols-outlined stat-icon text-[20px]">category</span>
            Category
          </div>
          <p className="font-stat text-caption text-on-surface-variant">
            {supplierId
              ? `${pool.length} ${pool.length === 1 ? "game" : "games"} from ${supplierHousehold?.label ?? "supplier"}`
              : "Select a supplier"}
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setCategory(opt.value);
                  setResult(null);
                }}
                className={`rune-chip rounded-full px-4 py-1.5 font-stat text-stat-label ${
                  category === opt.value ? "active" : "text-on-surface-variant"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player selection */}
      <div className="glass-card flex flex-col gap-stack-compact rounded-lg p-card-padding">
        <h2 className="flex items-center gap-2 font-display text-headline-lg-mobile text-on-surface">
          <span className="material-symbols-outlined stat-icon text-[20px]">group</span>
          Players
        </h2>
        <div className="flex flex-wrap gap-2">
          {profiles.map((p) => {
            const selected = selectedPlayers.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                className={`rune-chip flex items-center gap-2 rounded-full px-3 py-1.5 font-stat text-stat-label ${
                  selected ? "active" : "text-on-surface-variant"
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
                        ? "bg-on-primary-container/20 text-on-primary-container"
                        : "bg-surface-container-highest text-on-surface-variant"
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
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
        <div className="glass-card rounded-lg p-card-padding">
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
        </div>
        <div className="glass-card flex flex-col gap-stack-compact rounded-lg p-card-padding">
          <div className="flex items-center gap-2 font-stat text-stat-label text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
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
              className="carved-input w-20 rounded-lg px-3 py-1.5 text-sm tabular-nums placeholder-on-surface-variant/60 focus:outline-none"
            />
            <span className="text-xs text-on-surface-variant">to</span>
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
              className="carved-input w-20 rounded-lg px-3 py-1.5 text-sm tabular-nums placeholder-on-surface-variant/60 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Weighting + Aggression row */}
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
        <div className="glass-card flex flex-col gap-stack-compact rounded-lg p-card-padding">
          <div className="flex items-center gap-2 font-stat text-stat-label text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Weighting
          </div>
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setMode(opt.value);
                  setResult(null);
                }}
                className={`rune-chip rounded-full px-3 py-1.5 font-stat text-stat-label ${
                  mode === opt.value ? "active" : "text-on-surface-variant"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {mode !== "random" && (
          <div className="glass-card flex flex-col gap-stack-compact rounded-lg p-card-padding">
            <div className="flex items-center gap-2 font-stat text-stat-label text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Aggression
            </div>
            <div className="flex items-center gap-3">
              <span className="font-stat text-caption text-on-surface-variant">
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
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-surface-container-highest accent-primary-container"
              />
              <span className="font-stat text-caption text-on-surface-variant">
                Aggressive
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Spinner */}
      <div className="monster-card flex flex-col items-center gap-gutter rounded-lg p-6">
        <SpinnerWheel
          segments={segments}
          spinning={spinning}
          targetIndex={targetIndex}
          onSpinComplete={handleSpinComplete}
        />

        {/* Spin button */}
        <button
          onClick={handleSpin}
          disabled={spinning || pool.length === 0}
          className="stone-button flex items-center gap-2 rounded-md px-8 py-3 font-stat text-stat-label transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          <span className="material-symbols-outlined text-[18px]">casino</span>
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
            className="monster-card animate-pop-in mx-4 flex w-full max-w-sm flex-col gap-gutter rounded-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-stack-compact">
              <span className="font-stat text-caption uppercase tracking-wide text-primary">
                Summoned
              </span>
              {(result.image_url || result.thumbnail_url) && (
                <div className="relative aspect-square w-48 overflow-hidden rounded-md">
                  <Image
                    src={result.image_url || result.thumbnail_url || ""}
                    alt={result.name}
                    fill
                    className="object-contain"
                    sizes="192px"
                  />
                </div>
              )}
              <h3 className="text-center font-display text-headline-lg text-on-surface">
                {result.name}
              </h3>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {result.min_players && result.max_players && (
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined stat-icon text-[20px]">group</span>
                  <span className="font-stat text-stat-label text-on-surface">
                    {result.min_players === result.max_players
                      ? `${result.min_players}`
                      : `${result.min_players}-${result.max_players}`}
                  </span>
                </div>
              )}
              {result.playing_time && (
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined stat-icon text-[20px]">hourglass_empty</span>
                  <span className="font-stat text-stat-label text-on-surface">{result.playing_time}m</span>
                </div>
              )}
              {result.bgg_weight && (
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined stat-icon text-[20px]">fitness_center</span>
                  <span className="font-stat text-stat-label text-on-surface">{result.bgg_weight.toFixed(1)}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setResult(null)}
              className="stone-button w-full rounded-md px-4 py-2.5 font-stat text-stat-label"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
