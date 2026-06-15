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
      <div className="flex flex-col gap-stack-compact">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="group flex items-center gap-2 text-left"
        >
          <span className="material-symbols-outlined stat-icon text-[22px]">expand_less</span>
          <h2 className="font-display text-headline-lg text-on-surface transition-colors group-hover:text-primary">
            {title}
          </h2>
          <span className="font-stat text-stat-label text-on-surface-variant">
            collapse
          </span>
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
      className="monster-card group relative h-48 w-full cursor-pointer overflow-hidden rounded-lg"
    >
      {/* Preview content, clipped */}
      <div className="pointer-events-none h-48 overflow-hidden">
        {preview}
      </div>

      {/* Glass overlay */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-surface-container-low/40 backdrop-blur-[2px] transition-colors group-hover:bg-surface-container-low/20">
        <h2 className="font-display text-headline-lg text-primary">
          {title}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {description}
        </p>
        <span className="mt-2 flex items-center gap-1 font-stat text-stat-label text-on-surface-variant transition-colors group-hover:text-primary">
          <span className="material-symbols-outlined text-[16px]">unfold_more</span>
          Reveal
        </span>
      </div>
    </div>
  );
}
