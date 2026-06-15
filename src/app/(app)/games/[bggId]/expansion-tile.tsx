"use client";

import { useRef } from "react";
import Image from "next/image";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GameExpansion } from "@/types/database";

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

const TILE_CLASS =
  "relative h-16 w-16 shrink-0 overflow-hidden rounded border border-outline-variant bg-surface-container-high";

function TileImage({ expansion }: { expansion: GameExpansion }) {
  if (expansion.thumbnail_url) {
    return (
      <Image
        src={expansion.thumbnail_url}
        alt={expansion.name}
        fill
        className="object-contain"
        sizes="64px"
        draggable={false}
      />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center p-1 text-center text-[8px] leading-tight text-on-surface-variant">
      {expansion.name}
    </span>
  );
}

interface ExpansionTileProps {
  expansion: GameExpansion;
  isSelected?: boolean;
  onTileTap?: (id: string) => void;
}

export function ExpansionTile({ expansion, isSelected, onTileTap }: ExpansionTileProps) {
  const tapRef = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: expansion.id, animateLayoutChanges });

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
      onTileTap(expansion.id);
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
      title={expansion.name}
      className={`${TILE_CLASS} cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      } ${isSelected ? "z-10 scale-110 ring-2 ring-primary" : ""}`}
    >
      <TileImage expansion={expansion} />
    </div>
  );
}

export function ExpansionTileOverlay({ expansion }: { expansion: GameExpansion }) {
  return (
    <div title={expansion.name} className={`${TILE_CLASS} shadow-lg ring-2 ring-primary`}>
      <TileImage expansion={expansion} />
    </div>
  );
}
