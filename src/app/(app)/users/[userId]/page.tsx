import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getHouseholdIds } from "@/lib/household";
import type { BoardGame, Tier } from "@/types/database";
import { ReadOnlyTierRow } from "../../community/read-only-tier-row";
import { buildScoreMap } from "../../community/compute-shadow-ranks";
import type { AlignmentEntry } from "../../community/compute-alignment";

export const dynamic = "force-dynamic";

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, partner_id")
    .eq("id", userId)
    .single();

  if (!profile) notFound();

  const householdIds = await getHouseholdIds(supabase, userId);

  const [
    { data: partner },
    { data: placements },
    { data: games },
    { data: wishlistRows },
    { data: alignmentRows },
    { data: collectionRows },
  ] = await Promise.all([
    profile.partner_id
      ? supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", profile.partner_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("tier_placements")
      .select("bgg_id, tier, position, score")
      .eq("user_id", userId)
      .limit(10000),
    supabase.from("board_games").select("*"),
    supabase
      .from("user_game_collection")
      .select("bgg_id, board_games(name, thumbnail_url, bgg_id)")
      .in("user_id", householdIds)
      .eq("wishlist", true),
    supabase
      .from("user_alignments")
      .select("category, allies, rivals")
      .eq("user_id", userId),
    supabase
      .from("user_game_collection")
      .select("bgg_id")
      .in("user_id", householdIds)
      .eq("owned", true),
  ]);

  const gameMap = new Map<number, BoardGame>();
  for (const g of games ?? []) {
    gameMap.set(g.bgg_id, g);
  }

  // Build tier buckets per category
  const bucketsByCategory = buildBucketsByCategory(placements ?? [], gameMap);

  // Wishlist (deduplicated)
  const seen = new Set<number>();
  const wishlist = (wishlistRows ?? [])
    .filter((w) => {
      if (seen.has(w.bgg_id)) return false;
      seen.add(w.bgg_id);
      return true;
    })
    .map((w) => {
      const bg = w.board_games as unknown as { name: string; thumbnail_url: string | null; bgg_id: number } | null;
      return { bggId: w.bgg_id, name: bg?.name ?? "Unknown", thumbnailUrl: bg?.thumbnail_url ?? null };
    });

  // Alignment data
  const boardAlignment = (alignmentRows ?? []).find((r) => r.category === "board");
  const partyAlignment = (alignmentRows ?? []).find((r) => r.category === "party");

  // Favorite game per category (highest score)
  const favoriteBoard = getFavoriteGame(bucketsByCategory.board);
  const favoriteParty = getFavoriteGame(bucketsByCategory.party);

  // Top tags per category
  const boardTags = getTopTags(bucketsByCategory.board, gameMap, 5);
  const partyTags = getTopTags(bucketsByCategory.party, gameMap, 5);

  // Owned games (deduplicated, resolved from gameMap)
  const ownedBggIds = [...new Set((collectionRows ?? []).map((r) => r.bgg_id))];
  const ownedGames = ownedBggIds
    .map((id) => gameMap.get(id))
    .filter((g): g is BoardGame => g !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Stats
  const ownedCount = ownedBggIds.length;
  const boardRanked = TIERS.reduce((sum, t) => sum + bucketsByCategory.board[t].length, 0);
  const partyRanked = TIERS.reduce((sum, t) => sum + bucketsByCategory.party[t].length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name}
            width={72}
            height={72}
            className="h-18 w-18 rounded-full"
          />
        ) : (
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {profile.display_name}
          </h1>
          {partner && (
            <div className="mt-1 flex items-center gap-1.5">
              {partner.avatar_url && (
                <Image
                  src={partner.avatar_url}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-full"
                />
              )}
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                Married to {partner.display_name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Games Owned" value={ownedCount} />
        <StatCard label="Board Ranked" value={boardRanked} />
        <StatCard label="Party Ranked" value={partyRanked} />
      </div>

      {/* Owned games */}
      {ownedGames.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Collection
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {ownedGames.map((game) => {
              const img = game.thumbnail_url || game.image_url;
              return (
                <Link
                  key={game.bgg_id}
                  href={`/games/${game.bgg_id}`}
                  title={game.name}
                  className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-100 transition-opacity hover:opacity-80 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {img ? (
                    <Image
                      src={img}
                      alt={game.name}
                      fill
                      className="object-contain"
                      sizes="40px"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[7px] leading-tight text-zinc-400">
                      {game.name.slice(0, 4)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorites + Tags */}
      {(favoriteBoard || favoriteParty) && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {favoriteBoard && (
            <FavoriteCard game={favoriteBoard} label="Favorite Board Game" />
          )}
          {favoriteParty && (
            <FavoriteCard game={favoriteParty} label="Favorite Party Game" />
          )}
        </div>
      )}

      {/* Wishlist */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
          🎁 Wishlist
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {wishlist.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {wishlist.map((item) => (
                <Link
                  key={item.bggId}
                  href={`/games/${item.bggId}`}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded border border-zinc-200 object-contain dark:border-zinc-700"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-200 bg-zinc-100 text-[8px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
                      ?
                    </div>
                  )}
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No games on their wishlist yet.
            </p>
          )}
        </div>
      </section>

      {(boardTags.length > 0 || partyTags.length > 0) && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {boardTags.length > 0 && <TagsCard tags={boardTags} label="Top Board Game Categories" />}
          {partyTags.length > 0 && <TagsCard tags={partyTags} label="Top Party Game Categories" />}
        </div>
      )}

      {/* Alignment */}
      {(boardAlignment || partyAlignment) && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Taste Twins & Sworn Enemies
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {boardAlignment && (
              <AlignmentCard
                category="Board Games"
                allies={(boardAlignment.allies as AlignmentEntry[]) ?? []}
                rivals={(boardAlignment.rivals as AlignmentEntry[]) ?? []}
              />
            )}
            {partyAlignment && (
              <AlignmentCard
                category="Party Games"
                allies={(partyAlignment.allies as AlignmentEntry[]) ?? []}
                rivals={(partyAlignment.rivals as AlignmentEntry[]) ?? []}
              />
            )}
          </div>
        </section>
      )}

      {/* Tier Lists */}
      {boardRanked > 0 && (
        <TierListSection
          title="Board Game Rankings"
          buckets={bucketsByCategory.board}
        />
      )}
      {partyRanked > 0 && (
        <TierListSection
          title="Party Game Rankings"
          buckets={bucketsByCategory.party}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function FavoriteCard({ game, label }: { game: BoardGame; label: string }) {
  const imageUrl = game.image_url || game.thumbnail_url;
  return (
    <Link
      href={`/games/${game.bgg_id}`}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={game.name}
          width={48}
          height={48}
          className="h-12 w-12 rounded border border-zinc-200 object-contain dark:border-zinc-700"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
          ?
        </div>
      )}
      <div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">{game.name}</p>
      </div>
    </Link>
  );
}

function TagsCard({ tags, label }: { tags: string[]; label: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function AlignmentCard({
  category,
  allies,
  rivals,
}: {
  category: string;
  allies: AlignmentEntry[];
  rivals: AlignmentEntry[];
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {category}
      </p>
      <div className="space-y-3">
        {allies.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
              Taste Twins
            </p>
            <div className="space-y-1">
              {allies.map((a) => (
                <AlignmentPerson key={a.userId} entry={a} />
              ))}
            </div>
          </div>
        )}
        {rivals.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
              Sworn Enemies
            </p>
            <div className="space-y-1">
              {rivals.map((r) => (
                <AlignmentPerson key={r.userId} entry={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlignmentPerson({ entry }: { entry: AlignmentEntry }) {
  return (
    <Link
      href={`/users/${entry.userId}`}
      className="flex items-center gap-2 rounded p-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      {entry.avatarUrl ? (
        <Image
          src={entry.avatarUrl}
          alt={entry.displayName}
          width={20}
          height={20}
          className="h-5 w-5 rounded-full"
        />
      ) : (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {entry.displayName.charAt(0)}
        </div>
      )}
      <span className="text-sm text-zinc-900 dark:text-zinc-100">
        {entry.displayName}
      </span>
    </Link>
  );
}

function TierListSection({
  title,
  buckets,
}: {
  title: string;
  buckets: Record<Tier, BoardGame[]>;
}) {
  const total = TIERS.reduce((sum, t) => sum + buckets[t].length, 0);
  if (total === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        {TIERS.map((tier) => (
          <ReadOnlyTierRow
            key={tier}
            tier={tier}
            entries={buckets[tier].map((game) => ({ game, shadow: false }))}
          />
        ))}
      </div>
    </section>
  );
}

function buildBucketsByCategory(
  placements: { bgg_id: number; tier: string; position: number }[],
  gameMap: Map<number, BoardGame>,
): { board: Record<Tier, BoardGame[]>; party: Record<Tier, BoardGame[]> } {
  const result = {
    board: Object.fromEntries(TIERS.map((t) => [t, [] as BoardGame[]])) as Record<Tier, BoardGame[]>,
    party: Object.fromEntries(TIERS.map((t) => [t, [] as BoardGame[]])) as Record<Tier, BoardGame[]>,
  };

  const sorted = [...placements].sort((a, b) => a.position - b.position);
  for (const p of sorted) {
    const game = gameMap.get(p.bgg_id);
    if (!game) continue;
    const cat = game.category === "party" ? "party" : "board";
    const tier = p.tier as Tier;
    if (result[cat][tier]) {
      result[cat][tier].push(game);
    }
  }

  return result;
}

function getFavoriteGame(buckets: Record<Tier, BoardGame[]>): BoardGame | null {
  for (const tier of TIERS) {
    if (buckets[tier].length > 0) return buckets[tier][0];
  }
  return null;
}

const IGNORED_CATEGORIES = new Set(["Party Game", "Card Game"]);

function getTopTags(
  buckets: Record<Tier, BoardGame[]>,
  gameMap: Map<number, BoardGame>,
  n: number,
): string[] {
  const scoreMap = buildScoreMap(buckets);
  const tagPoints = new Map<string, number>();

  for (const tier of TIERS) {
    for (const game of buckets[tier]) {
      const score = scoreMap.get(game.bgg_id) ?? 0;
      for (const cat of game.categories) {
        if (IGNORED_CATEGORIES.has(cat)) continue;
        tagPoints.set(cat, (tagPoints.get(cat) ?? 0) + score);
      }
    }
  }

  return [...tagPoints.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag]) => tag);
}
