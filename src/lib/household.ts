import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns an array of user IDs that share a household collection.
 * If the user has a partner, returns [userId, partnerId].
 * Otherwise returns [userId].
 */
export async function getHouseholdIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("partner_id")
    .eq("id", userId)
    .single();

  if (profile?.partner_id) {
    return [userId, profile.partner_id];
  }
  return [userId];
}
