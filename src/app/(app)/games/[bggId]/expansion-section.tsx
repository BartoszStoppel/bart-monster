"use client";

import { useState } from "react";
import type {
  BggExpansionRef,
  ExpansionTierPlacement,
  GameExpansion,
} from "@/types/database";
import { ExpansionTierBoard } from "./expansion-tier-board";
import { ExpansionBankEditor } from "./expansion-bank-editor";
import {
  ExpansionCommunityModal,
  type CommunityExpansion,
} from "./expansion-community-modal";

interface ExpansionSectionProps {
  gameBggId: number;
  gameName: string;
  isAdmin: boolean;
  bggExpansions: BggExpansionRef[];
  bank: GameExpansion[];
  myPlacements: ExpansionTierPlacement[];
  community: CommunityExpansion[];
}

export function ExpansionSection({
  gameBggId,
  gameName,
  isAdmin,
  bggExpansions,
  bank,
  myPlacements,
  community,
}: ExpansionSectionProps) {
  const [showCommunity, setShowCommunity] = useState(false);

  // Non-admins see nothing until an admin has curated the word bank.
  if (bank.length === 0 && !isAdmin) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Expansion Tier List
        </h2>
        {bank.length > 0 && (
          <button
            onClick={() => setShowCommunity(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Community scores
          </button>
        )}
      </div>

      {bank.length > 0 ? (
        <ExpansionTierBoard
          gameBggId={gameBggId}
          expansions={bank}
          initialPlacements={myPlacements}
        />
      ) : (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          No expansions in the word bank yet. Add some below to let everyone rank them.
        </p>
      )}

      {isAdmin && (
        <div className="mt-4">
          <ExpansionBankEditor
            gameBggId={gameBggId}
            bggExpansions={bggExpansions}
            bank={bank}
          />
        </div>
      )}

      {showCommunity && (
        <ExpansionCommunityModal
          gameName={gameName}
          expansions={community}
          onClose={() => setShowCommunity(false)}
        />
      )}
    </div>
  );
}
