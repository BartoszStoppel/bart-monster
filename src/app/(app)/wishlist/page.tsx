import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getHouseholdIds } from "@/lib/household";
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

  const householdIds = await getHouseholdIds(supabase, user.id);
  const householdSet = new Set(householdIds);

  // Determine which user's wishlist to show
  const viewingOther = selectedUserId && !householdSet.has(selectedUserId);
  const targetIds = viewingOther
    ? await getHouseholdIds(supabase, selectedUserId)
    : householdIds;

  const [
    { data: targetWishlist },
    { data: allWishlist },
    { data: allOwned },
    { data: profiles },
    { data: boardGames },
    { data: tierPlacements },
  ] = await Promise.all([
    supabase
      .from("user_game_collection")
      .select("bgg_id, user_id, wishlist_priority, wishlist_note")
      .in("user_id", targetIds)
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

  // Build per-game wishlister lists (excluding target household)
  const targetSet = new Set(targetIds);
  const wishlistersByGame = new Map<number, ProfileInfo[]>();
  for (const w of allWishlist ?? []) {
    if (targetSet.has(w.user_id)) continue;
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

  // Build target wishlist items (deduplicated)
  const seen = new Set<number>();
  const targetItems: WishlistItem[] = [];
  for (const entry of targetWishlist ?? []) {
    if (seen.has(entry.bgg_id)) continue;
    seen.add(entry.bgg_id);
    const game = gameMap.get(entry.bgg_id);
    if (!game) continue;
    targetItems.push({
      game,
      priority: entry.wishlist_priority,
      note: entry.wishlist_note,
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
  const householdOwnedIds = new Set(
    (allOwned ?? [])
      .filter((o) => householdSet.has(o.user_id))
      .map((o) => o.bgg_id)
  );
  const householdWishlistIds = new Set(
    (allWishlist ?? [])
      .filter((w) => householdSet.has(w.user_id))
      .map((w) => w.bgg_id)
  );

  const candidateGames = [...sharedGameIds]
    .filter((id) => !householdOwnedIds.has(id) && !householdWishlistIds.has(id))
    .map((id) => gameMap.get(id))
    .filter(Boolean) as BoardGame[];

  const suggestions = viewingOther
    ? []
    : computeSuggestions(tierPlacements ?? [], candidateGames, gameMap);

  // Header label
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
          items={targetItems}
          suggestions={suggestions}
          readOnly={!!viewingOther}
        />
      )}
    </div>
  );
}
