/**
 * Profile page — redirected to /users/{id} by middleware (proxy.ts).
 * This file exists as a fallback; the middleware handles the redirect
 * before this component renders.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  redirect(`/users/${user.id}`);
}
