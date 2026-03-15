import Image from "next/image";
import type { BoardGame } from "@/types/database";

interface ReadOnlyGameTileProps {
  game: BoardGame;
}

export function ReadOnlyGameTile({ game }: ReadOnlyGameTileProps) {
  const imageUrl = game.image_url || game.thumbnail_url;

  return (
    <div
      title={game.name}
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={game.name}
          fill
          className="object-contain"
          sizes="64px"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[8px] leading-tight text-zinc-500 dark:text-zinc-400">
          {game.name}
        </span>
      )}
    </div>
  );
}
