import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getHouseholdIds } from "@/lib/household";
import type { BoardGame, Tier } from "@/types/database";
import { ReadOnlyTierRow } from "../../community/read-only-tier-row";
import { buildScoreMap } from "../../community/compute-shadow-ranks";
import type { AlignmentEntry } from "../../community/compute-alignment";
import { ProfileEditor } from "../../profile/profile-editor";
import { RoleBadge } from "@/components/role-badge";
import { TitleDisplay } from "@/components/title-display";

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
    .select("id, display_name, avatar_url, partner_id, is_admin")
    .eq("id", userId)
    .single();

  if (!profile) notFound();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = currentUser?.id === userId;

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
  const totalRanked = boardRanked + partyRanked;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-stack-loose">
      {/* Header band — adventurer hero */}
      <section className="monster-card flex flex-wrap items-center gap-gutter rounded-lg p-6">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full border border-outline-variant"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest font-display text-3xl font-bold text-on-surface-variant">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col gap-stack-compact">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-display-lg text-primary">
              {profile.display_name}
            </h1>
            <RoleBadge role={profile.is_admin ? "admin" : null} />
          </div>
          <p className="text-on-surface-variant">
            <TitleDisplay gamesRanked={totalRanked} gamesOwned={ownedCount} />
          </p>
          {isOwnProfile && currentUser.email && (
            <div className="font-stat text-stat-label text-on-surface-variant">
              {currentUser.email}
            </div>
          )}
          {partner && (
            <div className="flex items-center gap-1.5">
              {partner.avatar_url && (
                <Image
                  src={partner.avatar_url}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-full"
                />
              )}
              <span className="flex items-center gap-1 font-stat text-stat-label text-on-surface-variant">
                <span className="material-symbols-outlined stat-icon text-[16px]">favorite</span>
                Bound to {partner.display_name}
              </span>
            </div>
          )}
        </div>
      </section>

      {isOwnProfile && (
        <div className="glass-card rounded-lg p-card-padding">
          <ProfileEditor currentName={profile.display_name} userId={userId} />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-gutter">
        <StatCard label="Games Owned" value={ownedCount} icon="inventory_2" />
        <StatCard label="Board Ranked" value={boardRanked} icon="castle" />
        <StatCard label="Party Ranked" value={partyRanked} icon="celebration" />
      </div>

      {/* Owned games */}
      {ownedGames.length > 0 && (
        <section className="flex flex-col gap-stack-compact">
          <h2 className="font-display text-headline-lg text-on-surface">
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
                  className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-outline-variant bg-surface-container-high transition-opacity hover:opacity-80"
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
                    <span className="flex h-full w-full items-center justify-center text-[7px] leading-tight text-on-surface-variant">
                      {game.name.slice(0, 4)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Favorites + Tags */}
      {(favoriteBoard || favoriteParty) && (
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
          {favoriteBoard && (
            <FavoriteCard game={favoriteBoard} label="Favorite Board Game" />
          )}
          {favoriteParty && (
            <FavoriteCard game={favoriteParty} label="Favorite Party Game" />
          )}
        </div>
      )}

      {/* Wishlist */}
      <section className="flex flex-col gap-stack-compact">
        <h2 className="flex items-center gap-2 font-display text-headline-lg text-on-surface">
          <span className="material-symbols-outlined stat-icon text-[24px]">redeem</span>
          Wishlist
        </h2>
        <div className="glass-card rounded-lg p-card-padding">
          {wishlist.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {wishlist.map((item) => (
                <Link
                  key={item.bggId}
                  href={`/games/${item.bggId}`}
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-container-high"
                >
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded border border-outline-variant object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-outline-variant bg-surface-container-high text-[8px] text-on-surface-variant">
                      ?
                    </div>
                  )}
                  <span className="text-sm font-medium text-on-surface">
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              {isOwnProfile
                ? "No games on your wishlist yet."
                : "No games on their wishlist yet."}
            </p>
          )}
        </div>
      </section>

      {(boardTags.length > 0 || partyTags.length > 0) && (
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
          {boardTags.length > 0 && <TagsCard tags={boardTags} label="Top Board Game Categories" />}
          {partyTags.length > 0 && <TagsCard tags={partyTags} label="Top Party Game Categories" />}
        </div>
      )}

      {/* Alignment */}
      {(boardAlignment || partyAlignment) && (
        <section className="flex flex-col gap-stack-compact">
          <h2 className="flex items-center gap-2 font-display text-headline-lg text-on-surface">
            <span className="material-symbols-outlined stat-icon text-[24px]">groups</span>
            Taste Twins &amp; Sworn Enemies
          </h2>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
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

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="monster-card flex flex-col items-center gap-1 rounded-lg p-card-padding text-center">
      <span className="material-symbols-outlined stat-icon text-[22px]">{icon}</span>
      <div className="font-stat text-2xl font-bold text-on-surface">
        {value}
      </div>
      <div className="font-stat text-stat-label text-on-surface-variant">{label}</div>
    </div>
  );
}

function FavoriteCard({ game, label }: { game: BoardGame; label: string }) {
  const imageUrl = game.image_url || game.thumbnail_url;
  return (
    <Link
      href={`/games/${game.bgg_id}`}
      className="monster-card flex items-center gap-3 rounded-lg p-card-padding transition-colors hover:border-outline"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={game.name}
          width={48}
          height={48}
          className="h-12 w-12 rounded border border-outline-variant object-contain"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded border border-outline-variant bg-surface-container-high">
          ?
        </div>
      )}
      <div>
        <p className="flex items-center gap-1 font-stat text-stat-label text-on-surface-variant">
          <span className="material-symbols-outlined stat-icon text-[16px]">star</span>
          {label}
        </p>
        <p className="font-display text-headline-lg-mobile text-on-surface">{game.name}</p>
      </div>
    </Link>
  );
}

function TagsCard({ tags, label }: { tags: string[]; label: string }) {
  return (
    <div className="glass-card rounded-lg p-card-padding">
      <p className="mb-2 font-stat text-stat-label text-on-surface-variant">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rune-chip rounded-full px-2.5 py-1 text-xs font-medium text-on-surface-variant"
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
    <div className="glass-card rounded-lg p-card-padding">
      <p className="mb-3 font-stat text-stat-label text-on-surface-variant">
        {category}
      </p>
      <div className="space-y-3">
        {allies.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 font-stat text-stat-label text-secondary">
              <span className="material-symbols-outlined text-[16px]">handshake</span>
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
            <p className="mb-1.5 flex items-center gap-1 font-stat text-stat-label text-error">
              <span className="material-symbols-outlined text-[16px]">swords</span>
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
      className="flex items-center gap-2 rounded p-1 transition-colors hover:bg-surface-container-high"
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
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest text-[9px] font-medium text-on-surface-variant">
          {entry.displayName.charAt(0)}
        </div>
      )}
      <span className="text-sm text-on-surface">
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
    <section className="flex flex-col gap-stack-compact">
      <h2 className="font-display text-headline-lg text-on-surface">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-outline-variant">
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
