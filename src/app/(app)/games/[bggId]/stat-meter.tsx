"use client";

import { useEffect, useRef, useState } from "react";
import { BggMark } from "@/components/bgg-mark";

/**
 * A single labelled stat meter (matches the Complexity/Time bars from
 * design/code-detail.html): icon + label on the left, value on the right, a
 * recessed track + proportional fill below. `tone` picks amber vs slime-green.
 * The `hint` shows in a tooltip on hover (desktop) and on tap (mobile).
 */
export function StatMeter({
  icon,
  bggIcon,
  label,
  value,
  pct,
  tone = "amber",
  hint,
}: {
  icon?: string;
  bggIcon?: boolean;
  label: string;
  value: string;
  pct: number;
  tone?: "amber" | "green" | "brown";
  hint?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillClass = tone === "green" ? "time" : tone === "brown" ? "brown" : "";
  const valueClass =
    tone === "green" ? "text-secondary-container" : tone === "brown" ? "text-on-surface-variant" : "text-primary";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Tap-anywhere-else closes an open tooltip (mobile).
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  return (
    <div
      ref={ref}
      className="group relative flex h-full flex-col justify-end gap-1"
      onMouseEnter={() => hint && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => hint && setOpen((o) => !o)}
    >
      {hint && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 w-max max-w-[220px] rounded border border-outline-variant bg-surface-container-highest px-2.5 py-1.5 font-body text-caption leading-snug text-on-surface shadow-lg transition-opacity duration-150 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        >
          {hint}
        </div>
      )}
      <div className="flex items-end justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate whitespace-nowrap font-stat text-stat-label text-on-surface-variant">
          {bggIcon ? (
            <BggMark className="h-[14px] w-[14px] shrink-0" />
          ) : (
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          )}{" "}
          {label}
        </span>
        <span className={`shrink-0 whitespace-nowrap font-stat text-stat-label ${valueClass}`}>
          {value}
        </span>
      </div>
      <div className="stat-bar-track h-3 w-full">
        <div className={`stat-bar-fill ${fillClass}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
