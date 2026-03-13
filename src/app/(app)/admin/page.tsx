import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { UserRoleToggle } from "./user-role-toggle";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email, is_admin")
    .order("display_name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Admin — User Roles
      </h1>

      <div className="space-y-3">
        {profiles?.map((profile) => (
          <UserRoleToggle
            key={profile.id}
            userId={profile.id}
            displayName={profile.display_name ?? "Unknown"}
            email={profile.email ?? ""}
            isAdmin={profile.is_admin ?? false}
            isSelf={profile.id === user?.id}
          />
        ))}
      </div>
    </div>
  );
}
