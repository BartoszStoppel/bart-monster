"use client";

import { useRef } from "react";
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
  isSelected?: boolean;
  onTileTap?: (bggId: number) => void;
}

export function GameTile({ game, overlay, isSelected, onTileTap }: GameTileProps) {
  const tapRef = useRef<{ x: number; y: number } | null>(null);

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

  function handlePointerDown(e: React.PointerEvent) {
    tapRef.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!tapRef.current) return;
    const dx = Math.abs(e.clientX - tapRef.current.x);
    const dy = Math.abs(e.clientY - tapRef.current.y);
    tapRef.current = null;
    if (dx < 5 && dy < 5 && onTileTap) {
      onTileTap(game.bgg_id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      title={game.name}
      className={`relative h-16 w-16 shrink-0 cursor-grab overflow-hidden rounded border border-zinc-200 bg-zinc-100 active:cursor-grabbing dark:border-white/10 dark:bg-white/5 ${
        isDragging && !overlay ? "opacity-30" : ""
      } ${overlay ? "shadow-lg ring-2 ring-cyan-500" : ""} ${
        isSelected ? "ring-2 ring-amber-400 scale-110 z-10" : ""
      }`}
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
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100 shadow-lg ring-2 ring-cyan-500 dark:border-white/10 dark:bg-white/5"
    >
      <TileImage game={game} />
    </div>
  );
}

function TileImage({ game }: { game: BoardGame }) {
  const imageUrl = game.image_url || game.thumbnail_url;
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={game.name}
        fill
        className="object-contain"
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
