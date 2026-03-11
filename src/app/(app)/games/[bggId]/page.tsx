import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { RatingSection } from "./rating-section";
import type { GameRatingWithProfile } from "@/types/database";

export const dynamic = "force-dynamic";

interface GameDetailPageProps {
  params: Promise<{ bggId: string }>;
}

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { bggId: bggIdParam } = await params;
  const bggId = parseInt(bggIdParam, 10);
  if (isNaN(bggId)) notFound();

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("board_games")
    .select("*")
    .eq("bgg_id", bggId)
    .single();

  if (!game) notFound();

  const { data: ratings } = await supabase
    .from("game_ratings")
    .select("*, profiles(*)")
    .eq("bgg_id", bggId)
    .order("created_at", { ascending: false });

  const { data: owners } = await supabase
    .from("user_game_collection")
    .select("*, profiles(*)")
    .eq("bgg_id", bggId)
    .eq("owned", true);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const typedRatings = (ratings ?? []) as GameRatingWithProfile[];
  const userRating = typedRatings.find((r) => r.user_id === user?.id);

  const avgRating =
    typedRatings.length > 0
      ? typedRatings.reduce((sum, r) => sum + r.rating, 0) / typedRatings.length
      : null;

  const playerRange =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players} players`
        : `${game.min_players}-${game.max_players} players`
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row">
        {game.image_url && (
          <div className="relative h-64 w-48 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={game.image_url}
              alt={game.name}
              fill
              className="object-cover"
              sizes="192px"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {game.name}
          </h1>
          {game.year_published && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              ({game.year_published})
            </span>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            {playerRange && <span>{playerRange}</span>}
            {game.playing_time && <span>{game.playing_time} min</span>}
            {game.min_age && <span>Age {game.min_age}+</span>}
            {game.bgg_weight && (
              <span>Weight: {Number(game.bgg_weight).toFixed(1)}/5</span>
            )}
          </div>

          <div className="mt-3 flex gap-6">
            {game.bgg_rating && (
              <div>
                <div className="text-xs text-zinc-400">BGG Rating</div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {Number(game.bgg_rating).toFixed(1)}
                </div>
              </div>
            )}
            {avgRating !== null && (
              <div>
                <div className="text-xs text-zinc-400">Community Rating</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {avgRating.toFixed(1)}
                </div>
                <div className="text-xs text-zinc-400">
                  ({typedRatings.length} {typedRatings.length === 1 ? "rating" : "ratings"})
                </div>
              </div>
            )}
          </div>

          {owners && owners.length > 0 && (
            <div className="mt-3">
              <span className="text-xs text-zinc-400">Owned by: </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                {owners
                  .map((o) => (o.profiles as { display_name: string })?.display_name)
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}

          {game.categories && game.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {game.categories.map((cat: string) => (
                <span
                  key={cat}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {game.description && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Description
          </h2>
          <div className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {game.description.slice(0, 1000)}
            {game.description.length > 1000 ? "..." : ""}
          </div>
        </div>
      )}

      <RatingSection
        bggId={bggId}
        ratings={typedRatings}
        userRating={userRating ?? null}
      />
    </div>
  );
}
