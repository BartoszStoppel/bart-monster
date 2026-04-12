import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WishlistGrid } from "./wishlist-grid";
import { SharedWishlistView } from "./shared-wishlist-view";
import { ViewToggle } from "./view-toggle";
import { computeSuggestions } from "./compute-suggestions";
import type { BoardGame } from "@/types/database";
import type { WishlistItem, ProfileInfo } from "./wishlist-types";

export const dynamic = "force-dynamic";

interface WishlistPageProps {
  searchParams: Promise<{ view?: string; user?: string }>;
}

export default async function WishlistPage({ searchParams }: WishlistPageProps) {
  const { view, user: selectedUserId } = await searchParams;
  const isShared = view === "shared";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const viewingOther = selectedUserId && selectedUserId !== user.id;
  const targetUserId = viewingOther ? selectedUserId : user.id;

  const [
    { data: targetWishlist },
    { data: allWishlist },
    { data: allOwned },
    { data: profiles },
    { data: boardGames },
    { data: tierPlacements },
    { data: allPlacements },
  ] = await Promise.all([
    supabase
      .from("user_game_collection")
      .select("bgg_id, user_id, wishlist_priority, wishlist_note")
      .eq("user_id", targetUserId)
      .eq("wishlist", true),
    supabase
      .from("user_game_collection")
      .select("bgg_id, user_id")
      .eq("wishlist", true),
    supabase
      .from("user_game_collection")
      .select("bgg_id, user_id")
      .eq("owned", true),
    supabase.from("profiles").select("id, display_name, avatar_url"),
    supabase.from("board_games").select("*"),
    supabase
      .from("tier_placements")
      .select("bgg_id, tier, score")
      .eq("user_id", user.id),
    supabase
      .from("tier_placements")
      .select("bgg_id, score")
      .not("score", "is", null)
      .limit(10000),
  ]);

  const profileMap = new Map<string, ProfileInfo>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, {
      userId: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
    });
  }

  const gameMap = new Map<number, BoardGame>();
  for (const g of (boardGames ?? []) as BoardGame[]) {
    gameMap.set(g.bgg_id, g);
  }

  // Compute community average scores (min 3 ratings)
  const scoreAcc = new Map<number, { total: number; count: number }>();
  for (const p of allPlacements ?? []) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += Number(p.score);
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
  }
  const MIN_RATINGS = 3;
  const avgScoreMap = new Map<number, number>();
  for (const [bggId, { total, count }] of scoreAcc) {
    if (count >= MIN_RATINGS) {
      avgScoreMap.set(bggId, total / count);
    }
  }

  // Build users-with-wishlists list (at least 1 wishlisted game)
  const userWishlistCounts = new Map<string, number>();
  for (const w of allWishlist ?? []) {
    userWishlistCounts.set(w.user_id, (userWishlistCounts.get(w.user_id) ?? 0) + 1);
  }
  const usersWithWishlists: ProfileInfo[] = [];
  for (const [uid] of userWishlistCounts) {
    const profile = profileMap.get(uid);
    if (profile) usersWithWishlists.push(profile);
  }
  usersWithWishlists.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Build per-game wishlister lists (excluding target user)
  const wishlistersByGame = new Map<number, ProfileInfo[]>();
  for (const w of allWishlist ?? []) {
    if (w.user_id === targetUserId) continue;
    const list = wishlistersByGame.get(w.bgg_id) ?? [];
    const profile = profileMap.get(w.user_id);
    if (profile) list.push(profile);
    wishlistersByGame.set(w.bgg_id, list);
  }

  // Build per-game owner lists
  const ownersByGame = new Map<number, ProfileInfo[]>();
  for (const o of allOwned ?? []) {
    const list = ownersByGame.get(o.bgg_id) ?? [];
    const profile = profileMap.get(o.user_id);
    if (profile) list.push(profile);
    ownersByGame.set(o.bgg_id, list);
  }

  // Build target wishlist items
  const targetItems: WishlistItem[] = [];
  for (const entry of targetWishlist ?? []) {
    const game = gameMap.get(entry.bgg_id);
    if (!game) continue;
    targetItems.push({
      game,
      priority: entry.wishlist_priority,
      note: entry.wishlist_note,
      communityScore: avgScoreMap.get(entry.bgg_id) ?? null,
      otherWishlisters: wishlistersByGame.get(entry.bgg_id) ?? [],
      owners: ownersByGame.get(entry.bgg_id) ?? [],
    });
  }

  // Build shared wishlist data (all users, grouped by game)
  const sharedGameIds = new Set<number>();
  const allWishlistersByGame = new Map<number, ProfileInfo[]>();
  for (const w of allWishlist ?? []) {
    sharedGameIds.add(w.bgg_id);
    const list = allWishlistersByGame.get(w.bgg_id) ?? [];
    const profile = profileMap.get(w.user_id);
    if (profile) list.push(profile);
    allWishlistersByGame.set(w.bgg_id, list);
  }

  const sharedItems = [...sharedGameIds]
    .map((bggId) => {
      const game = gameMap.get(bggId);
      if (!game) return null;
      return {
        game,
        wishlisters: allWishlistersByGame.get(bggId) ?? [],
        owners: ownersByGame.get(bggId) ?? [],
      };
    })
    .filter(Boolean) as {
    game: BoardGame;
    wishlisters: ProfileInfo[];
    owners: ProfileInfo[];
  }[];

  // Compute suggestions (only for own wishlist)
  const myOwnedIds = new Set(
    (allOwned ?? [])
      .filter((o) => o.user_id === user.id)
      .map((o) => o.bgg_id)
  );
  const myWishlistIds = new Set(
    (allWishlist ?? [])
      .filter((w) => w.user_id === user.id)
      .map((w) => w.bgg_id)
  );

  const candidateGames = [...sharedGameIds]
    .filter((id) => !myOwnedIds.has(id) && !myWishlistIds.has(id))
    .map((id) => gameMap.get(id))
    .filter(Boolean) as BoardGame[];

  const suggestions = viewingOther
    ? []
    : computeSuggestions(tierPlacements ?? [], candidateGames, gameMap);

  const viewingProfile = viewingOther ? profileMap.get(selectedUserId) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {isShared
            ? "Everyone\u2019s Wishlist"
            : viewingProfile
              ? `${viewingProfile.displayName}\u2019s Wishlist`
              : "Wishlist"}
        </h1>
        <ViewToggle
          currentUserId={user.id}
          selectedUserId={selectedUserId ?? null}
          isShared={isShared}
          usersWithWishlists={usersWithWishlists}
        />
      </div>

      {isShared ? (
        <SharedWishlistView items={sharedItems} />
      ) : (
        <WishlistGrid
          key={targetUserId}
          items={targetItems}
          suggestions={suggestions}
          readOnly={!!viewingOther}
        />
      )}
    </div>
  );
}
