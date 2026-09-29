import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether the currently authenticated user has admin privileges.
 * @param supabase - An authenticated Supabase client (server or browser)
 * @returns `true` if the user is an admin, `false` otherwise
 */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return data?.is_admin === true;
}
