"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

interface UpdateGamePayload {
  bggId: number;
  category: "party" | "board";
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
}

/**
 * Updates editable metadata for a board game. Admin-only.
 * @param payload - The fields to update
 */
export async function updateGame(payload: UpdateGamePayload) {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("board_games")
    .update({
      category: payload.category,
      min_players: payload.minPlayers,
      max_players: payload.maxPlayers,
      playing_time: payload.playingTime,
    })
    .eq("bgg_id", payload.bggId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
