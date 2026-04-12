import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import Image from "next/image";
import { EditGameButton } from "./edit-game-button";
import { DeleteGameButton } from "./delete-game-button";
import { CollectionToggles } from "./collection-toggles";
import { BggDetails, SuggestedPlayersTable } from "./bgg-details";
import { getHouseholdIds } from "@/lib/household";
import { TIER_COLORS } from "@/lib/tier-colors";

export const dynamic = "force-dynamic";

interface GameDetailPageProps {
  params: Promise<{ bggId: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  party: "Party Game",
  board: "Board Game",
};

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

  const admin = await isAdmin(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: owners } = await supabase
    .from("user_game_collection")
    .select("*, profiles(id, display_name)")
    .eq("bgg_id", bggId)
    .eq("owned", true);

  const ownerInfos = (owners ?? [])
    .map((o) => ({
      displayName: (o.profiles as { display_name: string })?.display_name ?? "Unknown",
      userId: o.user_id,
    }))
    .filter((o) => o.displayName !== "Unknown");

  const householdIds = user ? await getHouseholdIds(supabase, user.id) : [];
  const householdSet = new Set(householdIds);
  const currentUserOwns = ownerInfos.some((o) => householdSet.has(o.userId));

  const { data: wishlisters } = await supabase
    .from("user_game_collection")
    .select("*, profiles(id, display_name)")
    .eq("bgg_id", bggId)
    .eq("wishlist", true);

  const wishlisterInfos = (wishlisters ?? [])
    .map((w) => ({
      displayName: (w.profiles as { display_name: string })?.display_name ?? "Unknown",
      userId: w.user_id,
    }))
    .filter((w) => w.displayName !== "Unknown");

  const { data: tierPlacements } = await supabase
    .from("tier_placements")
    .select("tier, score, user_id, profiles(display_name)")
    .eq("bgg_id", bggId)
    .order("score", { ascending: false });

  const rankings = (tierPlacements ?? [])
    .map((tp) => {
      const profile = Array.isArray(tp.profiles) ? tp.profiles[0] : tp.profiles;
      return {
        displayName: (profile as { display_name: string } | null)?.display_name ?? "Unknown",
        tier: tp.tier,
        score: tp.score ? Number(tp.score) : null,
      };
    })
    .filter((r) => r.displayName !== "Unknown");

  const currentUserWishlisted = wishlisterInfos.some((w) => householdSet.has(w.userId));

  const playerRange =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players} players`
        : `${game.min_players}-${game.max_players} players`
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row">
        {(game.image_url || game.thumbnail_url) && (
          <div className="relative h-64 w-48 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-white/5">
            <Image
              src={(game.image_url || game.thumbnail_url)!}
              alt={game.name}
              fill
              className="object-contain"
              sizes="192px"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {game.name}
            </h1>
            {game.category && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  game.category === "party"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                }`}
              >
                {CATEGORY_LABELS[game.category] ?? game.category}
              </span>
            )}
          </div>
          {admin && (
            <div className="flex flex-wrap items-center gap-3">
              <EditGameButton game={game} />
              <DeleteGameButton bggId={game.bgg_id} gameName={game.name} />
            </div>
          )}

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

          {game.bgg_rating && (
            <div className="mt-3">
              <div className="text-xs text-zinc-400">BGG Rating</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Number(game.bgg_rating).toFixed(1)}
              </div>
            </div>
          )}

          {user && (
            <CollectionToggles
              bggId={bggId}
              currentUserId={user.id}
              initialOwned={currentUserOwns}
              initialOwners={ownerInfos}
              initialWishlisted={currentUserWishlisted}
              initialWishlisters={wishlisterInfos}
            />
          )}

          {game.categories && game.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {game.categories.map((cat: string) => (
                <span
                  key={cat}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/5 dark:text-zinc-400"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {rankings.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Rankings ({rankings.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {rankings.map((r) => (
              <div
                key={r.displayName}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-white/[0.06] dark:bg-white/5"
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${TIER_COLORS[r.tier] ?? "bg-zinc-400"}`}
                >
                  {r.tier}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {r.displayName}
                </span>
                {r.score != null && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.score.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {game.suggested_players?.length > 0 && (
        <div className="mb-8">
          <SuggestedPlayersTable data={game.suggested_players} />
        </div>
      )}

      <BggDetails game={game} />
    </div>
  );
}
