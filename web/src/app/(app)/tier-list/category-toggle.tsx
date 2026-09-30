import { navigate } from "@/compat/navigation";
import { usePillIndicator } from "@/lib/use-pill-indicator";

export function TierCategoryToggle({
  category,
}: {
  category: "board" | "party";
}) {
  const { containerRef, setRef, pill } = usePillIndicator(category);

  function select(next: "board" | "party") {
    if (next === category) return;
    const query = new URLSearchParams(location.search);
    query.set("category", next);
    navigate(`/tier-list?${query}`);
  }

  return (
    <div className="mb-4 flex min-h-10 items-center">
      <div
        ref={containerRef}
        role="group"
        aria-label="Game category"
        className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
      >
        <div
          className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10"
          style={pill}
        />
        {(
          [
            ["party", "Party Games"],
            ["board", "Board Games"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            ref={(button) => setRef(value, button)}
            onClick={() => select(value)}
            aria-pressed={category === value}
            className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              category === value
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
