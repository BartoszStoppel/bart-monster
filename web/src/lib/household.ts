import type { SupabaseClient } from "@supabase/supabase-js";
export function householdIds(
  profiles: Array<{ id: string; partner_id?: string | null }>,
  userId: string,
): string[] {
  const ids = new Set([userId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of profiles)
      if (p.partner_id && (ids.has(p.id) || ids.has(p.partner_id))) {
        if (!ids.has(p.id) || !ids.has(p.partner_id)) changed = true;
        ids.add(p.id);
        ids.add(p.partner_id);
      }
  }
  return [...ids].filter((id) => profiles.some((p) => p.id === id));
}
export async function getHouseholdIds(client: SupabaseClient, userId: string) {
  const { data } = await client.from("profiles").select("id,partner_id");
  return householdIds(data ?? [], userId);
}
