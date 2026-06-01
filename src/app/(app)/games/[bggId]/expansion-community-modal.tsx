"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { Tier } from "@/types/database";
import { TIER_COLORS } from "@/lib/tier-colors";

export interface CommunityExpansionVote {
  displayName: string;
  tier: Tier;
  score: number | null;
}

export interface CommunityExpansion {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  avgScore: number | null;
  voteCount: number;
  votes: CommunityExpansionVote[];
}

interface ExpansionCommunityModalProps {
  gameName: string;
  expansions: CommunityExpansion[];
  onClose: () => void;
}

export function ExpansionCommunityModal({
  gameName,
  expansions,
  onClose,
}: ExpansionCommunityModalProps) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Community Expansion Scores
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{gameName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {expansions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No one has ranked these expansions yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {expansions.map((exp) => (
              <li
                key={exp.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                    {exp.thumbnailUrl && (
                      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-zinc-200 dark:border-white/10">
                        <Image
                          src={exp.thumbnailUrl}
                          alt={exp.name}
                          fill
                          className="object-contain"
                          sizes="32px"
                        />
                      </span>
                    )}
                    <span className="truncate">{exp.name}</span>
                  </span>
                  <span className="shrink-0 text-sm">
                    {exp.avgScore != null ? (
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {exp.avgScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                    <span className="ml-1 text-xs text-zinc-400">
                      ({exp.voteCount} {exp.voteCount === 1 ? "vote" : "votes"})
                    </span>
                  </span>
                </div>
                {exp.votes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exp.votes.map((v) => (
                      <span
                        key={v.displayName}
                        className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs dark:border-white/10 dark:bg-white/5"
                        title={v.score != null ? `${v.score.toFixed(1)}` : undefined}
                      >
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white ${
                            TIER_COLORS[v.tier] ?? "bg-zinc-400"
                          }`}
                        >
                          {v.tier}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {v.displayName}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
