import Image from "next/image";
import type { BoardGame } from "@/types/database";

interface ReadOnlyGameTileProps {
  game: BoardGame;
  shadow?: boolean;
  hotTake?: boolean;
}

export function ReadOnlyGameTile({ game, shadow, hotTake }: ReadOnlyGameTileProps) {
  const imageUrl = game.image_url || game.thumbnail_url;

  let borderClass: string;
  if (hotTake) {
    borderClass = "border-red-500 shadow-[0_0_14px_5px_rgba(239,68,68,0.6)] dark:border-red-400 dark:shadow-[0_0_14px_5px_rgba(239,68,68,0.5)]";
  } else if (shadow) {
    borderClass = "border-dashed border-purple-400 opacity-40 dark:border-purple-500";
  } else {
    borderClass = "border-zinc-200 dark:border-zinc-700";
  }

  return (
    <div
      title={shadow ? `${game.name} (predicted)` : hotTake ? `${game.name} 🔥 Hottest take` : game.name}
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800 ${borderClass}`}
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
