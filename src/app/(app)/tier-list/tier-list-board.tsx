"use client";

import { useState, useCallback, useRef, useMemo, useEffect, useId } from "react";
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
      className={`mt-4 rounded-lg border border-dashed border-zinc-300 dark:border-white/10 ${
        isOver ? "bg-zinc-100 dark:bg-white/5/50" : ""
      } ${selectedBggId !== null ? "bg-zinc-50 dark:bg-white/5/30" : ""}`}
    >
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Unplayed — tap to select, then tap to place
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
  const dndId = useId();
  const [category, setCategory] = useState(initialCategory);
  const games = category === "party" ? partyGames : boardGames;
  const placements = useMemo(
    () => filterPlacements(allPlacements, games),
    [allPlacements, games]
  );

  const toggleContainerRef = useRef<HTMLDivElement>(null);
  const partyBtnRef = useRef<HTMLButtonElement>(null);
  const boardBtnRef = useRef<HTMLButtonElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const activeRef = category === "party" ? partyBtnRef : boardBtnRef;
    const el = activeRef.current;
    const container = toggleContainerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setPillStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [category]);

  const savedBuckets = useRef<TierBuckets | null>(null);
  const [buckets, setBuckets] = useState<TierBuckets>(() =>
    buildBuckets(games, placements)
  );
  const [activeGame, setActiveGame] = useState<BoardGame | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedBggId, setSelectedBggId] = useState<number | null>(null);
  const { save, saving, error: saveError } = useTierSave();

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
    const categoryGameIds = games.map((g) => g.bgg_id);
    try {
      await save(tierEntries, categoryGameIds);
      savedBuckets.current = { ...buckets };
      setDirty(false);
      setSelectedBggId(null);
    } catch {
      // error state is set inside useTierSave
    }
  }, [buckets, games, save]);

  const handleDiscard = useCallback(() => {
    if (savedBuckets.current) {
      setBuckets(savedBuckets.current);
    } else {
      setBuckets(buildBuckets(games, placements));
    }
    setDirty(false);
    setSelectedBggId(null);
  }, [games, placements]);

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
          const filtered = prev[fromTier].filter((g) => g.bgg_id !== selectedBggId);
          const targetIndex = filtered.findIndex((g) => g.bgg_id === tappedBggId);
          filtered.splice(targetIndex, 0, game);
          return { ...prev, [fromTier]: filtered };
        }

        const fromGames = prev[fromTier].filter((g) => g.bgg_id !== selectedBggId);
        const toGames = [...prev[toTier]];
        const targetIndex = toGames.findIndex((g) => g.bgg_id === tappedBggId);
        toGames.splice(targetIndex, 0, game);
        return { ...prev, [fromTier]: fromGames, [toTier]: toGames };
      });
      setDirty(true);
      setSelectedBggId(null);
    },
    [selectedBggId]
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
      setDirty(true);
    },
    [selectedBggId]
  );

  function handleDragStart(event: DragStartEvent) {
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
    setSelectedBggId(null);
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
        <div ref={toggleContainerRef} className="relative flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/5">
          <div
            className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm transition-all duration-200 ease-in-out dark:bg-white/10"
            style={{ left: pillStyle.left, width: pillStyle.width }}
          />
          <button
            ref={partyBtnRef}
            onClick={() => handleCategoryToggle("party")}
            className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              category === "party"
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Party Games
          </button>
          <button
            ref={boardBtnRef}
            onClick={() => handleCategoryToggle("board")}
            className={`relative z-10 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              category === "board"
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            Board Games
          </button>
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gradient-to-r from-cyan-500 to-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition-colors shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="font-medium">Best</span>
        <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-rose-500" />
        <span className="font-medium">Worst</span>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
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
