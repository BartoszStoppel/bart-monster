export type SupabaseClient = ReturnType<
  typeof import("@/lib/supabase/client").createClient
>;
export interface User {
  id: string;
  email?: string;
  is_admin?: boolean;
  user_metadata: {
    avatar_url?: string;
    full_name?: string;
    [key: string]: unknown;
  };
}
