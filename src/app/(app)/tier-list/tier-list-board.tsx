"use client";

import { useState, useCallback, useRef, useMemo } from "react";
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
import { MIN_RANKED_GAMES } from "./compute-scores";

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
}

type TierBuckets = Record<Tier | "unplayed", BoardGame[]>;

function buildBuckets(
  games: BoardGame[],
  placements: TierPlacement[]
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
  gameId: number
): Tier | "unplayed" | null {
  for (const key of [...TIERS, "unplayed"] as (Tier | "unplayed")[]) {
    if (buckets[key].some((g) => g.bgg_id === gameId)) {
      return key;
    }
  }
  return null;
}

function UnplayedRow({ games }: { games: BoardGame[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tier-unplayed" });
  const gameIds = games.map((g) => g.bgg_id);

  return (
    <div
      className={`mt-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 ${
        isOver ? "bg-zinc-100 dark:bg-zinc-800/50" : ""
      }`}
    >
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Unplayed — drag games into tiers above
      </div>
      <SortableContext
        id="tier-unplayed"
        items={gameIds}
        strategy={horizontalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex min-h-[4.5rem] flex-wrap items-center gap-1 px-3 pb-2"
        >
          {games.map((game) => (
            <GameTile key={game.bgg_id} game={game} />
          ))}
          {games.length === 0 && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
  games: BoardGame[]
): TierPlacement[] {
  const gameIds = new Set(games.map((g) => g.bgg_id));
  return placements.filter((p) => gameIds.has(p.bgg_id));
}

export function TierListBoard({
  partyGames,
  boardGames,
  allPlacements,
  initialCategory,
}: TierListBoardProps) {
  const [category, setCategory] = useState(initialCategory);
  const games = category === "party" ? partyGames : boardGames;
  const placements = useMemo(
    () => filterPlacements(allPlacements, games),
    [allPlacements, games]
  );

  const savedBuckets = useRef<TierBuckets | null>(null);
  const [buckets, setBuckets] = useState<TierBuckets>(() =>
    buildBuckets(games, placements)
  );
  const [activeGame, setActiveGame] = useState<BoardGame | null>(null);
  const [dirty, setDirty] = useState(false);
  const { save, saving, error: saveError } = useTierSave();

  const rankedCount = useMemo(
    () => TIERS.reduce((sum, tier) => sum + buckets[tier].length, 0),
    [buckets]
  );
  const canSave = rankedCount >= MIN_RANKED_GAMES;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleSave = useCallback(async () => {
    const tierEntries = TIERS.map((tier) => ({
      tier,
      games: buckets[tier],
    }));
    try {
      await save(tierEntries);
      savedBuckets.current = { ...buckets };
      setDirty(false);
    } catch {
      // error state is set inside useTierSave
    }
  }, [buckets, save]);

  const handleDiscard = useCallback(() => {
    if (savedBuckets.current) {
      setBuckets(savedBuckets.current);
    } else {
      setBuckets(buildBuckets(games, placements));
    }
    setDirty(false);
  }, [games, placements]);

  function handleDragStart(event: DragStartEvent) {
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
        (g) => g.bgg_id !== activeId
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
    setDirty(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveGame(null);

    if (!over) return;

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
        setDirty(true);
      }
    }
  }

  function handleCategoryToggle(cat: "party" | "board") {
    if (cat === category) return;
    const nextGames = cat === "party" ? partyGames : boardGames;
    const nextPlacements = filterPlacements(allPlacements, nextGames);
    const fresh = buildBuckets(nextGames, nextPlacements);
    savedBuckets.current = fresh;
    setBuckets(fresh);
    setDirty(false);
    setCategory(cat);
  }

  return (
    <div>
      {saveError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {saveError}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            onClick={() => handleCategoryToggle("party")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              category === "party"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Party Games
          </button>
          <button
            onClick={() => handleCategoryToggle("board")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              category === "board"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Board Games
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${canSave ? "text-zinc-400 dark:text-zinc-500" : "text-amber-600 dark:text-amber-400"}`}>
            {rankedCount}/{MIN_RANKED_GAMES} ranked
          </span>
          {dirty && (
            <>
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                title={canSave ? undefined : `Rank at least ${MIN_RANKED_GAMES} games to save`}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="font-medium">Best</span>
        <div className="flex items-center gap-0.5">
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-rose-500" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 text-rose-500"
          >
            <path
              fillRule="evenodd"
              d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <span className="font-medium">Worst</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          {TIERS.map((tier) => (
            <TierRow key={tier} tier={tier} games={buckets[tier]} />
          ))}
        </div>

        <UnplayedRow games={buckets.unplayed} />

        <DragOverlay>
          {activeGame ? <GameTileOverlay game={activeGame} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
