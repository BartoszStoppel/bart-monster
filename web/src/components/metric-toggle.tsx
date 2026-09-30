import Link from "next/link";
import { metric } from "@/lib/api";
export function MetricToggle() {
  const current = metric();
  return (
    <div
      className="flex gap-1 rounded-lg bg-surface-container-low p-1"
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
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${current === value ? "bg-primary-container text-on-primary-container shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            {value === "enjoyment" ? "Enjoyment" : "Difficulty"}
          </Link>
        );
      })}
    </div>
  );
}
