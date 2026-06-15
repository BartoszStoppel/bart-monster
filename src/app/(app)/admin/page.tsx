import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-display-lg text-primary">The Keeper&apos;s Seal</h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Grant or revoke guild-master rank. Only the sealed may shape the codex.
            </p>
          </div>
          <Link
            href="/admin/rules"
            className="stone-button flex items-center gap-2 rounded-md px-5 py-2.5 font-stat text-stat-label"
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Manage Rulebooks
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-3">
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
