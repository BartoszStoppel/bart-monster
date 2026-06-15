"use client";

import { TIER_COLORS } from "@/lib/tier-colors";

const TIERS = ["S", "A", "B", "C", "D", "F"] as const;

interface TierRangeSelectorProps {
  selectedTiers: Set<string>;
  onToggle: (tier: string) => void;
  onReset: () => void;
}

export function TierRangeSelector({
  selectedTiers,
  onToggle,
  onReset,
}: TierRangeSelectorProps) {
  const allSelected = selectedTiers.size === TIERS.length;

  return (
    <div className="flex flex-col gap-stack-compact">
      <div className="flex items-center gap-2 font-stat text-stat-label text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px]">stairs</span>
        <span>Tiers</span>
        {!allSelected && (
          <button
            onClick={onReset}
            className="ml-auto flex items-center gap-1 font-stat text-caption text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            Reset
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {TIERS.map((t) => {
          const active = selectedTiers.has(t);
          return (
            <button
              key={t}
              onClick={() => onToggle(t)}
              className={`flex-1 rounded-md py-1.5 text-center font-stat text-sm font-bold text-white transition-all ${TIER_COLORS[t]} ${
                active ? "scale-105 opacity-100" : "opacity-25"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
