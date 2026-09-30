import { navigate } from "@/compat/navigation";

export function TierCategoryToggle({
  category,
}: {
  category: "board" | "party";
}) {
  function select(next: "board" | "party") {
    if (next === category) return;
    const query = new URLSearchParams(location.search);
    query.set("category", next);
    navigate(`/tier-list?${query}`);
  }

  return (
    <div className="mb-gutter flex min-h-10 items-center pr-28">
      <div
        role="group"
        aria-label="Game category"
        className="flex flex-wrap items-center gap-3"
      >
        {(["party", "board"] as const).map((value) => (
          <button
            key={value}
            onClick={() => select(value)}
            aria-pressed={category === value}
            className={`rune-chip flex items-center gap-2 rounded-full px-4 py-1.5 font-stat text-stat-label ${category === value ? "active" : "text-on-surface-variant"}`}
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[16px]"
            >
              {value === "party" ? "celebration" : "castle"}
            </span>
            {value === "party" ? "Party" : "Board"}
          </button>
        ))}
      </div>
    </div>
  );
}
