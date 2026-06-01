"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getThumbnailsByIds } from "@/lib/bgg/client";
import { revalidatePath } from "next/cache";

interface AddExpansionsInput {
  gameBggId: number;
  expansions: Array<{ name: string; bggExpansionId?: number | null }>;
}

/**
 * Adds one or more expansions to a game's rankable word bank. Admin-only.
 * Duplicate names for the same game are silently ignored.
 * @param input - The target game and the expansions to add.
 */
export async function addExpansionsToBank(input: AddExpansionsInput): Promise<void> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    throw new Error("Unauthorized");
  }

  const cleaned = input.expansions
    .map((e) => ({ name: e.name.trim(), bggExpansionId: e.bggExpansionId ?? null }))
    .filter((e) => e.name.length > 0);

  if (cleaned.length === 0) {
    throw new Error("No valid expansion names provided");
  }

  // Pull box-art thumbnails for BGG-sourced entries so the tier list can show
  // images. If BGG is unreachable we still add the expansions (name-only tiles).
  const bggIds = cleaned
    .map((e) => e.bggExpansionId)
    .filter((id): id is number => id != null);

  let thumbnails = new Map<number, string>();
  if (bggIds.length > 0) {
    try {
      thumbnails = await getThumbnailsByIds(bggIds);
    } catch (err) {
      console.warn("[expansion-actions] thumbnail fetch failed, adding without images:", err);
    }
  }

  const rows = cleaned.map((e) => ({
    game_bgg_id: input.gameBggId,
    name: e.name,
    bgg_expansion_id: e.bggExpansionId,
    thumbnail_url:
      e.bggExpansionId != null ? thumbnails.get(e.bggExpansionId) ?? null : null,
  }));

  const { error } = await supabase
    .from("game_expansions")
    .upsert(rows, { onConflict: "game_bgg_id,name", ignoreDuplicates: true });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/games/${input.gameBggId}`);
}

interface RemoveExpansionInput {
  expansionId: string;
  gameBggId: number;
}

/**
 * Removes an expansion from a game's word bank. Admin-only.
 * Cascades to delete any tier placements for that expansion.
 * @param input - The expansion id to remove and its game (for revalidation).
 */
export async function removeExpansionFromBank(input: RemoveExpansionInput): Promise<void> {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("game_expansions")
    .delete()
    .eq("id", input.expansionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/games/${input.gameBggId}`);
}
