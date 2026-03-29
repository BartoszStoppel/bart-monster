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
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="group relative h-48 w-full cursor-pointer overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
    >
      {/* Preview content, clipped */}
      <div className="pointer-events-none overflow-hidden">
        {preview}
      </div>

      {/* Glass overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm transition-colors group-hover:bg-white/50 dark:bg-zinc-900/60 dark:group-hover:bg-zinc-900/50">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </button>
  );
}
