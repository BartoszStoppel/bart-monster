"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BggExpansionRef, GameExpansion } from "@/types/database";
import { addExpansionsToBank, removeExpansionFromBank } from "./expansion-actions";

interface ExpansionBankEditorProps {
  gameBggId: number;
  /** Expansions BGG knows about for this game (the source list). */
  bggExpansions: BggExpansionRef[];
  /** Expansions currently in the curated word bank. */
  bank: GameExpansion[];
}

export function ExpansionBankEditor({
  gameBggId,
  bggExpansions,
  bank,
}: ExpansionBankEditorProps) {
  const router = useRouter();
  const [selectedBgg, setSelectedBgg] = useState<Set<number>>(new Set());
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // BGG entries not yet in the bank (matched by bgg id or name).
  const availableBgg = useMemo(() => {
    const usedIds = new Set(
      bank.map((b) => b.bgg_expansion_id).filter((id): id is number => id != null)
    );
    const usedNames = new Set(bank.map((b) => b.name.toLowerCase()));
    return bggExpansions.filter(
      (e) => !usedIds.has(e.id) && !usedNames.has(e.name.toLowerCase())
    );
  }, [bggExpansions, bank]);

  function toggleBgg(id: number) {
    setSelectedBgg((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddSelected() {
    const chosen = availableBgg.filter((e) => selectedBgg.has(e.id));
    if (chosen.length === 0) return;
    await run(async () => {
      await addExpansionsToBank({
        gameBggId,
        expansions: chosen.map((e) => ({ name: e.name, bggExpansionId: e.id })),
      });
      setSelectedBgg(new Set());
    });
  }

  async function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    await run(async () => {
      await addExpansionsToBank({ gameBggId, expansions: [{ name }] });
      setCustomName("");
    });
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary-container/5 p-4">
      <h3 className="mb-3 text-sm font-semibold text-primary">
        Manage expansion word bank (admin)
      </h3>

      {error && <p className="mb-3 text-xs text-error">{error}</p>}

      {bank.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-on-surface-variant">
            In the word bank
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bank.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface"
              >
                {b.name}
                <button
                  onClick={() =>
                    run(() => removeExpansionFromBank({ expansionId: b.id, gameBggId }))
                  }
                  disabled={busy}
                  className="text-on-surface-variant transition-colors hover:text-error disabled:opacity-50"
                  aria-label={`Remove ${b.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {availableBgg.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-on-surface-variant">
            Add from BGG
          </p>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-outline-variant p-2">
            {availableBgg.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-2 text-xs text-on-surface"
              >
                <input
                  type="checkbox"
                  checked={selectedBgg.has(e.id)}
                  onChange={() => toggleBgg(e.id)}
                  className="h-3.5 w-3.5"
                />
                <span className="truncate">{e.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleAddSelected}
            disabled={busy || selectedBgg.size === 0}
            className="stone-button mt-2 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Add selected ({selectedBgg.size})
          </button>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-on-surface-variant">
          Add a custom expansion
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            placeholder="e.g. Cities & Knights"
            className="carved-input flex-1 rounded px-2 py-1.5 text-xs"
          />
          <button
            onClick={handleAddCustom}
            disabled={busy || customName.trim().length === 0}
            className="stone-button rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
