"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  preview: React.ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  children,
  preview,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-3 flex items-center gap-2 text-left"
        >
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            collapse
          </span>
          <svg
            className="h-4 w-4 rotate-180 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {children}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(true)}
      onKeyDown={(e) => { if (e.key === "Enter") setExpanded(true); }}
      className="group relative h-48 w-full cursor-pointer overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10"
    >
      {/* Preview content, clipped */}
      <div className="pointer-events-none h-48 overflow-hidden">
        {preview}
      </div>

      {/* Glass overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 backdrop-blur-[2px] transition-colors group-hover:bg-white/15 dark:bg-zinc-900/30 dark:group-hover:bg-zinc-900/15">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}
