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

  return (
    <Link
      href={`/games/${game.bgg_id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {owned && (
          <div className="absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {game.thumbnail_url ? (
          <Image
            src={game.thumbnail_url}
            alt={game.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {game.name}
        </h3>

        <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {game.year_published ? <span>{game.year_published}</span> : null}
          {playerRange ? <span>{playerRange} players</span> : null}
          {game.playing_time ? <span>{game.playing_time} min</span> : null}
        </div>

        <div className="mt-auto flex items-center gap-3 pt-2">
          {avgScore != null ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-400">Ours</span>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {avgScore.toFixed(1)}
              </span>
            </div>
          ) : null}
          {game.bgg_rating ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-400">BGG</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {game.bgg_rating.toFixed(1)}
              </span>
            </div>
          ) : null}
          {game.bgg_weight ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-400">Weight</span>
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                {game.bgg_weight.toFixed(1)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
