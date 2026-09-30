"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { usePillIndicator } from "@/lib/use-pill-indicator";

interface CategoryToggleProps {
  category: "party" | "board";
  basePath: string;
}

export function CategoryToggle({ category, basePath }: CategoryToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { containerRef, setRef, pill } = usePillIndicator(category);

  function handleToggle(cat: "party" | "board") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", cat);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div
      ref={containerRef}
      className="relative flex gap-1 rounded-lg bg-surface-container-low p-1"
    >
      <div
        className="absolute top-1 bottom-1 rounded-md bg-primary-container shadow-sm transition-all duration-200 ease-in-out"
        style={pill}
      />
      <button
        ref={(button) => setRef("party", button)}
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
        ref={(button) => setRef("board", button)}
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
