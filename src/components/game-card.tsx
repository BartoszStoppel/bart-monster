import Image from "next/image";
import Link from "next/link";
import type { BoardGame } from "@/types/database";

interface GameCardProps {
  game: BoardGame;
  avgScore?: number;
  owned?: boolean;
}

export function GameCard({ game, avgScore, owned }: GameCardProps) {
  const playerRange =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players}`
        : `${game.min_players}-${game.max_players}`
      : null;

  const imageUrl = game.image_url || game.thumbnail_url;

  return (
    <Link
      href={`/games/${game.bgg_id}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {owned && (
          <div className="absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={game.name}
            fill
            className="object-contain transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            No image
          </div>
        )}

        {/* Score overlays on image */}
        <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-0.5">
          {avgScore != null && (
            <div className="flex items-center gap-1 rounded-md bg-blue-600 px-1.5 py-0.5 shadow">
              <span className="text-[9px] font-medium text-blue-200">Ours</span>
              <span className="text-xs font-bold text-white">{avgScore.toFixed(1)}</span>
            </div>
          )}
          {game.bgg_rating ? (
            <div className="flex items-center gap-1 rounded-md bg-orange-500 px-1.5 py-0.5 shadow">
              <span className="text-[9px] font-medium text-orange-200">BGG</span>
              <span className="text-xs font-bold text-white">{game.bgg_rating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <h3 className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
          {game.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
          {game.year_published ? <span>♦ {game.year_published}</span> : null}
          {playerRange ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span>♟ {playerRange}</span>
            </>
          ) : null}
          {game.playing_time ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span>⏱ {game.playing_time}m</span>
            </>
          ) : null}
          {game.bgg_weight ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span>⚖ {game.bgg_weight.toFixed(1)}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
