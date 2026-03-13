"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

/**
 * Toggles the is_admin flag for a given user. Only callable by admins.
 * @param targetUserId - The profile ID to toggle
 * @param newValue - Whether the user should be admin
 */
export async function setUserAdmin(targetUserId: string, newValue: boolean) {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: newValue })
    .eq("id", targetUserId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
}
