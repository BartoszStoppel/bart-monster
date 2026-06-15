"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface CategoryToggleProps {
  category: "party" | "board";
  basePath: string;
}

export function CategoryToggle({ category, basePath }: CategoryToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const partyRef = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLButtonElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const activeRef = category === "party" ? partyRef : boardRef;
    const el = activeRef.current;
    const container = containerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setPillStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [category]);

  function handleToggle(cat: "party" | "board") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", cat);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div ref={containerRef} className="relative flex gap-1 rounded-lg bg-surface-container-low p-1">
      <div
        className="absolute top-1 bottom-1 rounded-md bg-primary-container shadow-sm transition-all duration-200 ease-in-out"
        style={{ left: pillStyle.left, width: pillStyle.width }}
      />
      <button
        ref={partyRef}
        onClick={() => handleToggle("party")}
        className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          category === "party"
            ? "text-on-primary-container"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        Party Games
      </button>
      <button
        ref={boardRef}
        onClick={() => handleToggle("board")}
        className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          category === "board"
            ? "text-on-primary-container"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        Board Games
      </button>
    </div>
  );
}
