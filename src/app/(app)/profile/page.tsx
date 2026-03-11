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

  const { data: ratings } = await supabase
    .from("game_ratings")
    .select("*, board_games(name)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const { data: collection } = await supabase
    .from("user_game_collection")
    .select("*, board_games(name, bgg_id)")
    .eq("user_id", user.id);

  const avgRating =
    ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : null;

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
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {profile?.display_name ?? "User"}
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
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {collection?.length ?? 0}
          </div>
          <div className="text-xs text-zinc-500">Games</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {ratings?.length ?? 0}
          </div>
          <div className="text-xs text-zinc-500">Ratings</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {avgRating ? avgRating.toFixed(1) : "-"}
          </div>
          <div className="text-xs text-zinc-500">Avg Rating</div>
        </div>
      </div>

      {/* Recent Ratings */}
      {ratings && ratings.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Your Ratings
          </h2>
          <div className="space-y-2">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
              >
                <a
                  href={`/games/${r.bgg_id}`}
                  className="text-sm font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                >
                  {(r.board_games as { name: string })?.name ?? `Game #${r.bgg_id}`}
                </a>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {r.rating}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
