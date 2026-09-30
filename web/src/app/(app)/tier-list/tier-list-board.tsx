import { metric } from "@/lib/api";
("use client");

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useId,
  useEffect,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
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
import { useDroppable } from "@dnd-kit/core";
import type { BoardGame, Tier, TierPlacement } from "@/types/database";
import { GameTile, GameTileOverlay } from "./game-tile";
import { TierRow } from "./tier-row";
import { useTierSave } from "./use-tier-save";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

interface TierListBoardProps {
  partyGames: BoardGame[];
  boardGames: BoardGame[];
  allPlacements: TierPlacement[];
  initialCategory: "party" | "board";
  revision: string;
}

type TierBuckets = Record<Tier | "unplayed", BoardGame[]>;

function buildBuckets(
  games: BoardGame[],
  placements: TierPlacement[],
): TierBuckets {
  const buckets: TierBuckets = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    F: [],
    unplayed: [],
  };

  const placementMap = new Map<number, TierPlacement>();
  for (const p of placements) {
    placementMap.set(p.bgg_id, p);
  }

  const gameMap = new Map<number, BoardGame>();
  for (const g of games) {
    gameMap.set(g.bgg_id, g);
  }

  for (const p of placements) {
    const game = gameMap.get(p.bgg_id);
    if (game) {
      buckets[p.tier].push(game);
    }
  }

  for (const tier of TIERS) {
    const tierPlacements = placements
      .filter((p) => p.tier === tier)
      .sort((a, b) => a.position - b.position);
    buckets[tier] = tierPlacements
      .map((p) => gameMap.get(p.bgg_id))
      .filter((g): g is BoardGame => g !== undefined);
  }

  for (const game of games) {
    if (!placementMap.has(game.bgg_id)) {
      buckets.unplayed.push(game);
    }
  }

  return buckets;
}

function findContainer(
  buckets: TierBuckets,
  gameId: number,
): Tier | "unplayed" | null {
  for (const key of [...TIERS, "unplayed"] as (Tier | "unplayed")[]) {
    if (buckets[key].some((g) => g.bgg_id === gameId)) {
      return key;
    }
  }
  return null;
}

function UnplayedRow({
  games,
  selectedBggId,
  onTileTap,
  onTierTap,
}: {
  games: BoardGame[];
  selectedBggId: number | null;
  onTileTap: (bggId: number) => void;
  onTierTap: (tier: Tier | "unplayed") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "tier-unplayed" });
  const gameIds = games.map((g) => g.bgg_id);

  return (
    <div
      className={`mt-gutter rounded-lg border border-dashed border-outline-variant ${
        isOver ? "bg-surface-container-highest" : ""
      } ${selectedBggId !== null ? "bg-surface-container-high" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Move selected game to Unranked"
        onClick={() => onTierTap("unplayed")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTierTap("unplayed");
          }
        }}
        className="flex items-center gap-2 px-card-padding py-2 font-stat text-caption uppercase tracking-wide text-on-surface-variant"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
          inventory_2
        </span>
        Unranked — tap to select, then tap to place
      </div>
      <SortableContext
        id="tier-unplayed"
        items={gameIds}
        strategy={horizontalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex min-h-[4.5rem] flex-wrap items-center gap-1 px-3 pb-2"
          onClick={(e) => {
            if (e.target === e.currentTarget) onTierTap("unplayed");
          }}
        >
          {games.map((game) => (
            <GameTile
              key={game.bgg_id}
              game={game}
              isSelected={selectedBggId === game.bgg_id}
              onTileTap={onTileTap}
            />
          ))}
          {games.length === 0 && (
            <span className="text-xs text-on-surface-variant">
              All games have been ranked!
            </span>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function filterPlacements(
  placements: TierPlacement[],
  games: BoardGame[],
): TierPlacement[] {
  const gameIds = new Set(games.map((g) => g.bgg_id));
  return placements.filter((p) => gameIds.has(p.bgg_id));
}

export function TierListBoard({
  partyGames,
  boardGames,
  allPlacements,
  initialCategory,
  revision,
}: TierListBoardProps) {
  const dndId = useId();
  const category = initialCategory;
  const games = category === "party" ? partyGames : boardGames;
  const placements = useMemo(
    () => filterPlacements(allPlacements, games),
    [allPlacements, games],
  );

  const [buckets, setBuckets] = useState<TierBuckets>(() =>
    buildBuckets(games, placements),
  );
  const [activeGame, setActiveGame] = useState<BoardGame | null>(null);
  const [selectedBggId, setSelectedBggId] = useState<number | null>(null);
  const {
    save,
    saving,
    error: saveError,
  } = useTierSave(category, metric(), revision);

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
    if (activeGame) return;
    const state = JSON.stringify(buckets);
    if (state === savedState.current) return;
    savedState.current = state;
    saveRef.current(TIERS.map((tier) => ({ tier, games: buckets[tier] })));
  }, [buckets, activeGame]);
  const dragOrigin = useRef(buckets);

  const handleTileTap = useCallback(
    (tappedBggId: number) => {
      if (selectedBggId === null) {
        setSelectedBggId(tappedBggId);
        return;
      }

      if (selectedBggId === tappedBggId) {
        setSelectedBggId(null);
        return;
      }

      setBuckets((prev) => {
        const fromTier = findContainer(prev, selectedBggId);
        const toTier = findContainer(prev, tappedBggId);
        if (!fromTier || !toTier) return prev;

        const game = prev[fromTier].find((g) => g.bgg_id === selectedBggId);
        if (!game) return prev;

        if (fromTier === toTier) {
          const filtered = prev[fromTier].filter(
            (g) => g.bgg_id !== selectedBggId,
          );
          const targetIndex = filtered.findIndex(
            (g) => g.bgg_id === tappedBggId,
          );
          filtered.splice(targetIndex, 0, game);
          return { ...prev, [fromTier]: filtered };
        }

        const fromGames = prev[fromTier].filter(
          (g) => g.bgg_id !== selectedBggId,
        );
        const toGames = [...prev[toTier]];
        const targetIndex = toGames.findIndex((g) => g.bgg_id === tappedBggId);
        toGames.splice(targetIndex, 0, game);
        return { ...prev, [fromTier]: fromGames, [toTier]: toGames };
      });
      setSelectedBggId(null);
    },
    [selectedBggId],
  );

  const handleTierTap = useCallback(
    (tier: Tier | "unplayed") => {
      if (selectedBggId === null) return;

      setBuckets((prev) => {
        const fromTier = findContainer(prev, selectedBggId);
        if (!fromTier) return prev;

        if (fromTier === tier) {
          const items = prev[fromTier];
          const lastItem = items[items.length - 1];
          if (lastItem?.bgg_id === selectedBggId) {
            setSelectedBggId(null);
            return prev;
          }
          const filtered = items.filter((g) => g.bgg_id !== selectedBggId);
          const game = items.find((g) => g.bgg_id === selectedBggId);
          if (!game) return prev;
          setSelectedBggId(null);
          return { ...prev, [fromTier]: [...filtered, game] };
        }

        const game = prev[fromTier].find((g) => g.bgg_id === selectedBggId);
        if (!game) return prev;

        setSelectedBggId(null);
        return {
          ...prev,
          [fromTier]: prev[fromTier].filter((g) => g.bgg_id !== selectedBggId),
          [tier]: [...prev[tier], game],
        };
      });
    },
    [selectedBggId],
  );

  function handleDragStart(event: DragStartEvent) {
    dragOrigin.current = buckets;
    setSelectedBggId(null);
    const id = event.active.id as number;
    const allGames = Object.values(buckets).flat();
    const game = allGames.find((g) => g.bgg_id === id);
    setActiveGame(game ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id as number | string;

    const fromContainer = findContainer(buckets, activeId);
    let toContainer: Tier | "unplayed" | null = null;

    if (typeof overId === "string" && overId.startsWith("tier-")) {
      toContainer = overId.replace("tier-", "") as Tier | "unplayed";
    } else {
      toContainer = findContainer(buckets, overId as number);
    }

    if (!fromContainer || !toContainer || fromContainer === toContainer) return;

    setBuckets((prev) => {
      const game = prev[fromContainer].find((g) => g.bgg_id === activeId);
      if (!game) return prev;

      const fromGames = prev[fromContainer].filter(
        (g) => g.bgg_id !== activeId,
      );

      const overIndex =
        typeof overId === "number"
          ? prev[toContainer].findIndex((g) => g.bgg_id === overId)
          : -1;

      const toGames = [...prev[toContainer]];
      if (overIndex >= 0) {
        toGames.splice(overIndex, 0, game);
      } else {
        toGames.push(game);
      }

      return {
        ...prev,
        [fromContainer]: fromGames,
        [toContainer]: toGames,
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveGame(null);

    if (!over) {
      setBuckets(dragOrigin.current);
      return;
    }

    const activeId = active.id as number;
    const overId = over.id as number | string;

    const container = findContainer(buckets, activeId);
    if (!container) return;

    let targetContainer: Tier | "unplayed" = container;
    if (typeof overId === "string" && overId.startsWith("tier-")) {
      targetContainer = overId.replace("tier-", "") as Tier | "unplayed";
    }

    if (container === targetContainer && typeof overId === "number") {
      const items = buckets[container];
      const oldIndex = items.findIndex((g) => g.bgg_id === activeId);
      const newIndex = items.findIndex((g) => g.bgg_id === overId);

      if (oldIndex !== newIndex) {
        setBuckets({
          ...buckets,
          [container]: arrayMove(items, oldIndex, newIndex),
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-gutter">
      {saveError && (
        <div className="rounded-lg border border-error bg-error-container/15 p-card-padding text-sm text-error">
          {saveError}
        </div>
      )}
      <span
        role="status"
        aria-label="Ranking save status"
        aria-live="polite"
        className="absolute right-0 top-3 text-xs text-on-surface-variant"
      >
        {saveError
          ? "Unsaved changes"
          : saving
            ? "Saving…"
            : "All changes saved"}
      </span>

      <div className="flex items-center gap-2 font-stat text-caption text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined stat-icon text-[16px]">
          trophy
        </span>
        <span>{metric() === "difficulty" ? "Hardest" : "Best"}</span>
        <div className="h-1 w-16 rounded-full bg-gradient-to-r from-secondary-container to-error-container" />
        <span>{metric() === "difficulty" ? "Easiest" : "Worst"}</span>
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-error">
          skull
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
          setActiveGame(null);
        }}
      >
        <div className="monster-card overflow-hidden rounded-lg">
          {TIERS.map((tier) => (
            <TierRow
              key={tier}
              tier={tier}
              games={buckets[tier]}
              selectedBggId={selectedBggId}
              onTileTap={handleTileTap}
              onTierTap={handleTierTap}
            />
          ))}
        </div>

        <UnplayedRow
          games={buckets.unplayed}
          selectedBggId={selectedBggId}
          onTileTap={handleTileTap}
          onTierTap={handleTierTap}
        />

        <DragOverlay>
          {activeGame ? <GameTileOverlay game={activeGame} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
