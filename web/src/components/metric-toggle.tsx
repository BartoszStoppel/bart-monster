import Link from "next/link";
import { metric } from "@/lib/api";
export function MetricToggle() {
  const current = metric();
  return (
    <div
      className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5"
      aria-label="Rating metric"
    >
      {(["enjoyment", "difficulty"] as const).map((value) => {
        const query = new URLSearchParams(location.search);
        query.set("metric", value);
        return (
          <Link
            key={value}
            href={`${location.pathname}?${query}`}
            aria-current={current === value ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${current === value ? "bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
          >
            {value === "enjoyment" ? "Enjoyment" : "Difficulty"}
          </Link>
        );
      })}
    </div>
  );
}
