"use client";

import Image from "next/image";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardGame } from "@/types/database";

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface GameTileProps {
  game: BoardGame;
  overlay?: boolean;
}

export function GameTile({ game, overlay }: GameTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: game.bgg_id, animateLayoutChanges });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      title={game.name}
      className={`relative h-16 w-16 shrink-0 cursor-grab overflow-hidden rounded border border-zinc-200 bg-zinc-100 active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800 ${
        isDragging && !overlay ? "opacity-30" : ""
      } ${overlay ? "shadow-lg ring-2 ring-blue-500" : ""}`}
    >
      <TileImage game={game} />
    </div>
  );
}

interface GameTileOverlayProps {
  game: BoardGame;
}

export function GameTileOverlay({ game }: GameTileOverlayProps) {
  return (
    <div
      title={game.name}
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100 shadow-lg ring-2 ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <TileImage game={game} />
    </div>
  );
}

function TileImage({ game }: { game: BoardGame }) {
  if (game.thumbnail_url) {
    return (
      <Image
        src={game.thumbnail_url}
        alt={game.name}
        fill
        className="object-cover"
        sizes="64px"
        draggable={false}
      />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center text-[8px] leading-tight text-zinc-500 dark:text-zinc-400">
      {game.name}
    </span>
  );
}
