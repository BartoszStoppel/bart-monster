"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Moves a game from wishlist to owned collection.
 * Sets owned=true and wishlist=false.
 */
export async function moveToOwned(bggId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_game_collection")
    .update({ owned: true, wishlist: false, wishlist_priority: null, wishlist_note: null })
    .eq("user_id", user.id)
    .eq("bgg_id", bggId);

  if (error) throw new Error(error.message);
  revalidatePath("/wishlist");
  revalidatePath("/");
}

/**
 * Removes a game from the wishlist.
 */
export async function removeFromWishlist(bggId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_game_collection")
    .update({ wishlist: false, wishlist_priority: null, wishlist_note: null })
    .eq("user_id", user.id)
    .eq("bgg_id", bggId);

  if (error) throw new Error(error.message);
  revalidatePath("/wishlist");
}

/**
 * Adds a game to the current user's wishlist (used from suggestions).
 */
export async function addToWishlist(bggId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_game_collection")
    .upsert(
      { user_id: user.id, bgg_id: bggId, wishlist: true, owned: false },
      { onConflict: "user_id,bgg_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/wishlist");
}
