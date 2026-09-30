"use client";

import { useEffect, useCallback, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import type {
  CollisionDetection,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type {
  ExpansionTierPlacement,
  GameExpansion,
  Tier,
} from "@/types/database";
import { ExpansionTile, ExpansionTileOverlay } from "./expansion-tile";
import { ExpansionTierRow } from "./expansion-tier-row";
import { useExpansionTierSave } from "./use-expansion-tier-save";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

type Buckets = Record<Tier | "unranked", GameExpansion[]>;

function buildBuckets(
  expansions: GameExpansion[],
  placements: ExpansionTierPlacement[],
): Buckets {
  const buckets: Buckets = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    F: [],
    unranked: [],
  };
  const expMap = new Map(expansions.map((e) => [e.id, e]));
  const placed = new Set<string>();

  for (const tier of TIERS) {
    const tierPlacements = placements
      .filter((p) => p.tier === tier)
      .sort((a, b) => a.position - b.position);
    buckets[tier] = tierPlacements
      .map((p) => expMap.get(p.expansion_id))
      .filter((e): e is GameExpansion => e !== undefined);
    for (const p of tierPlacements) placed.add(p.expansion_id);
  }

  for (const exp of expansions) {
    if (!placed.has(exp.id)) buckets.unranked.push(exp);
  }

  return buckets;
}

function findContainer(buckets: Buckets, id: string): Tier | "unranked" | null {
  for (const key of [...TIERS, "unranked"] as (Tier | "unranked")[]) {
    if (buckets[key].some((e) => e.id === id)) return key;
  }
  return null;
}

function UnrankedRow({
  expansions,
  selectedId,
  onTileTap,
  onTierTap,
}: {
  expansions: GameExpansion[];
  selectedId: string | null;
  onTileTap: (id: string) => void;
  onTierTap: (tier: Tier | "unranked") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "etier-unranked" });
  const ids = expansions.map((e) => e.id);

  return (
    <div
      className={`mt-4 rounded-lg border border-dashed border-outline-variant ${
        isOver ? "bg-surface-container-highest" : ""
      } ${selectedId !== null ? "bg-surface-container-high" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Move selected game to Unranked"
        onClick={() => onTierTap("unranked")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTierTap("unranked");
          }
        }}
        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
      >
        Unranked — tap to select, then tap a tier to place
      </div>
      <SortableContext
        id="etier-unranked"
        items={ids}
        strategy={horizontalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex min-h-[4.5rem] flex-wrap items-center gap-1.5 px-3 pb-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) onTierTap("unranked");
          }}
        >
          {expansions.map((exp) => (
            <ExpansionTile
              key={exp.id}
              expansion={exp}
              isSelected={selectedId === exp.id}
              onTileTap={onTileTap}
            />
          ))}
          {expansions.length === 0 && (
            <span className="text-xs text-on-surface-variant">
              All expansions ranked!
            </span>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface ExpansionTierBoardProps {
  gameBggId: number;
  expansions: GameExpansion[];
  initialPlacements: ExpansionTierPlacement[];
  revision: string;
}

export function ExpansionTierBoard({
  gameBggId,
  expansions,
  initialPlacements,
  revision,
}: ExpansionTierBoardProps) {
  const dndId = useId();
  const savedBuckets = useRef<Buckets | null>(null);
  const [buckets, setBuckets] = useState<Buckets>(() =>
    buildBuckets(expansions, initialPlacements),
  );
  const [activeExpansion, setActiveExpansion] = useState<GameExpansion | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    save,
    saving,
    error: saveError,
  } = useExpansionTierSave(gameBggId, revision);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const savedState = useRef(JSON.stringify(buckets));
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (activeExpansion) return;
    const state = JSON.stringify(buckets);
    if (state === savedState.current) return;
    savedState.current = state;
    saveRef.current(TIERS.map((tier) => ({ tier, expansions: buckets[tier] })));
  }, [buckets, activeExpansion]);
  const dragOrigin = useRef(buckets);

  const handleTileTap = useCallback(
    (tappedId: string) => {
      if (selectedId === null) {
        setSelectedId(tappedId);
        return;
      }
      if (selectedId === tappedId) {
        setSelectedId(null);
        return;
      }

      setBuckets((prev) => {
        const fromTier = findContainer(prev, selectedId);
        const toTier = findContainer(prev, tappedId);
        if (!fromTier || !toTier) return prev;

        const exp = prev[fromTier].find((e) => e.id === selectedId);
        if (!exp) return prev;

        if (fromTier === toTier) {
          const filtered = prev[fromTier].filter((e) => e.id !== selectedId);
          const targetIndex = filtered.findIndex((e) => e.id === tappedId);
          filtered.splice(targetIndex, 0, exp);
          return { ...prev, [fromTier]: filtered };
        }

        const fromExps = prev[fromTier].filter((e) => e.id !== selectedId);
        const toExps = [...prev[toTier]];
        const targetIndex = toExps.findIndex((e) => e.id === tappedId);
        toExps.splice(targetIndex, 0, exp);
        return { ...prev, [fromTier]: fromExps, [toTier]: toExps };
      });
      setSelectedId(null);
    },
    [selectedId],
  );

  const handleTierTap = useCallback(
    (tier: Tier | "unranked") => {
      if (selectedId === null) return;

      setBuckets((prev) => {
        const fromTier = findContainer(prev, selectedId);
        if (!fromTier) return prev;

        const exp = prev[fromTier].find((e) => e.id === selectedId);
        if (!exp) return prev;

        if (fromTier === tier) {
          const items = prev[fromTier];
          if (items[items.length - 1]?.id === selectedId) return prev;
          const filtered = items.filter((e) => e.id !== selectedId);
          return { ...prev, [fromTier]: [...filtered, exp] };
        }

        return {
          ...prev,
          [fromTier]: prev[fromTier].filter((e) => e.id !== selectedId),
          [tier]: [...prev[tier], exp],
        };
      });
      setSelectedId(null);
    },
    [selectedId],
  );

  function handleDragStart(event: DragStartEvent) {
    dragOrigin.current = buckets;
    setSelectedId(null);
    const id = event.active.id as string;
    const exp = Object.values(buckets)
      .flat()
      .find((e) => e.id === id);
    setActiveExpansion(exp ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const fromContainer = findContainer(buckets, activeId);
    const toContainer = overId.startsWith("etier-")
      ? (overId.replace("etier-", "") as Tier | "unranked")
      : findContainer(buckets, overId);

    if (!fromContainer || !toContainer || fromContainer === toContainer) return;

    setBuckets((prev) => {
      const exp = prev[fromContainer].find((e) => e.id === activeId);
      if (!exp) return prev;

      const fromExps = prev[fromContainer].filter((e) => e.id !== activeId);
      const overIndex = overId.startsWith("etier-")
        ? -1
        : prev[toContainer].findIndex((e) => e.id === overId);

      const toExps = [...prev[toContainer]];
      if (overIndex >= 0) {
        toExps.splice(overIndex, 0, exp);
      } else {
        toExps.push(exp);
      }

      return { ...prev, [fromContainer]: fromExps, [toContainer]: toExps };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveExpansion(null);
    if (!over) {
      setBuckets(dragOrigin.current);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const container = findContainer(buckets, activeId);
    if (!container) return;

    if (!overId.startsWith("etier-")) {
      const items = buckets[container];
      const oldIndex = items.findIndex((e) => e.id === activeId);
      const newIndex = items.findIndex((e) => e.id === overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        setBuckets({
          ...buckets,
          [container]: arrayMove(items, oldIndex, newIndex),
        });
      }
    }
  }

  return (
    <div>
      {saveError && (
        <div className="mb-4 rounded-lg border border-error bg-error-container/15 p-3 text-sm text-error">
          {saveError}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="font-medium">Best</span>
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-secondary-container to-error-container" />
          <span className="font-medium">Worst</span>
        </div>
        <span
          role="status"
          aria-label="Ranking save status"
          aria-live="polite"
          className="text-xs text-on-surface-variant"
        >
          {saveError
            ? "Unsaved changes"
            : saving
              ? "Saving…"
              : "All changes saved"}
        </span>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setBuckets(dragOrigin.current);
          setActiveExpansion(null);
        }}
      >
        <div className="overflow-hidden rounded-lg border border-outline-variant">
          {TIERS.map((tier) => (
            <ExpansionTierRow
              key={tier}
              tier={tier}
              expansions={buckets[tier]}
              selectedId={selectedId}
              onTileTap={handleTileTap}
              onTierTap={handleTierTap}
            />
          ))}
        </div>

        <UnrankedRow
          expansions={buckets.unranked}
          selectedId={selectedId}
          onTileTap={handleTileTap}
          onTierTap={handleTierTap}
        />

        <DragOverlay>
          {activeExpansion ? (
            <ExpansionTileOverlay expansion={activeExpansion} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
