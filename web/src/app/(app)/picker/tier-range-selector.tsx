"use client";

const TIERS = ["S", "A", "B", "C", "D", "F"] as const;
const TIER_BG_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-slate-500",
];

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
    <div>
      <div className="mb-2 flex items-baseline gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span>Tiers</span>
        {!allSelected && (
          <button
            onClick={onReset}
            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {TIERS.map((t, i) => {
          const active = selectedTiers.has(t);
          return (
            <button
              key={t}
              onClick={() => onToggle(t)}
              className={`flex-1 rounded-md py-1.5 text-center text-xs font-bold text-white transition-all ${TIER_BG_COLORS[i]} ${
                active ? "opacity-100 scale-105" : "opacity-25"
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
