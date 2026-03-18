import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getHouseholdIds } from "@/lib/household";
import { WishlistList } from "../../(app)/profile/wishlist-list";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const householdIds = await getHouseholdIds(supabase, user.id);

  const { data: collection } = await supabase
    .from("user_game_collection")
    .select("*, board_games(name, bgg_id)")
    .in("user_id", householdIds)
    .eq("wishlist", true);

  const seen = new Set<number>();
  const items = (collection ?? [])
    .filter((c) => {
      if (seen.has(c.bgg_id)) return false;
      seen.add(c.bgg_id);
      return true;
    })
    .map((c) => ({
      bggId: c.bgg_id,
      name: (c.board_games as { name: string; bgg_id: number })?.name ?? "Unknown",
    }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Wishlist
      </h1>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <WishlistList items={items} userId={user.id} />
      </div>
    </div>
  );
}
