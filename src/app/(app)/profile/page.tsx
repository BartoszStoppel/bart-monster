import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileEditor } from "./profile-editor";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: collection } = await supabase
    .from("user_game_collection")
    .select("*, board_games(name, bgg_id)")
    .eq("user_id", user.id);

  const { data: placements } = await supabase
    .from("tier_placements")
    .select("*")
    .eq("user_id", user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Profile
      </h1>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-4">
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {profile?.display_name ?? "User"}
              </span>
              {profile?.is_admin && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Admin
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {user.email}
            </div>
          </div>
        </div>

        <ProfileEditor
          currentName={profile?.display_name ?? ""}
          userId={user.id}
        />
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {collection?.length ?? 0}
          </div>
          <div className="text-xs text-zinc-500">Games</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {placements?.length ?? 0}
          </div>
          <div className="text-xs text-zinc-500">Ranked</div>
        </div>
      </div>
    </div>
  );
}
