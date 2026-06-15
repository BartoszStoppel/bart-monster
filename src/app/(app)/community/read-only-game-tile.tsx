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
    borderClass = "border-error shadow-[0_0_14px_5px_rgba(163,1,19,0.6)]";
  } else if (shadow) {
    borderClass = "border-dashed border-primary opacity-40";
  } else {
    borderClass = "border-outline-variant";
  }

  return (
    <div
      title={shadow ? `${game.name} (predicted)` : hotTake ? `${game.name} 🔥 Hottest take` : game.name}
      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded bg-surface-container-high ${borderClass}`}
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
        <span className="flex h-full w-full items-center justify-center text-[8px] leading-tight text-on-surface-variant">
          {game.name}
        </span>
      )}
    </div>
  );
}
