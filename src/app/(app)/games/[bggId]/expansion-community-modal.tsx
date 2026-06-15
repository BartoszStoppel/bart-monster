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
        className="glass-card max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">
              Community Expansion Scores
            </h3>
            <p className="text-sm text-on-surface-variant">{gameName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {expansions.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No one has ranked these expansions yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {expansions.map((exp) => (
              <li
                key={exp.id}
                className="rounded-lg border border-outline-variant p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-on-surface">
                    {exp.thumbnailUrl && (
                      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-outline-variant">
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
                      <span className="font-stat font-bold text-primary">
                        {exp.avgScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                    <span className="ml-1 text-xs text-on-surface-variant">
                      ({exp.voteCount} {exp.voteCount === 1 ? "vote" : "votes"})
                    </span>
                  </span>
                </div>
                {exp.votes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exp.votes.map((v) => (
                      <span
                        key={v.displayName}
                        className="inline-flex items-center gap-1 rounded border border-outline-variant bg-surface-container-high px-1.5 py-0.5 text-xs"
                        title={v.score != null ? `${v.score.toFixed(1)}` : undefined}
                      >
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white ${
                            TIER_COLORS[v.tier] ?? "bg-surface-container-highest"
                          }`}
                        >
                          {v.tier}
                        </span>
                        <span className="text-on-surface-variant">
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
