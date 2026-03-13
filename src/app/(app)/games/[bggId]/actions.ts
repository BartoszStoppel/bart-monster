"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

/**
 * Deletes a game and all related data. Admin-only.
 * Foreign keys have ON DELETE CASCADE, so deleting from board_games
 * removes tier_placements and user_game_collection rows automatically.
 */
export async function deleteGame(bggId: number) {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("board_games")
    .delete()
    .eq("bgg_id", bggId);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/");
}
