import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AchievementHolder {
  display_name: string;
  avatar_url: string | null;
  detail: string | null;
}

interface AchievementDisplay {
  title: string;
  description: string;
  icon: string;
  holder: AchievementHolder | null;
}

export default async function AchievementsPage() {
  const supabase = await createClient();

  const achievements: AchievementDisplay[] = [];

  // --- Database-stored achievements ---
  const { data: dbAchievements } = await supabase
    .from("achievements")
    .select("id, title, description, icon");

  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id, detail, user_id");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url");

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  for (const achievement of dbAchievements ?? []) {
    const award = (userAchievements ?? []).find(
      (ua) => ua.achievement_id === achievement.id
    );
    const profile = award ? profileMap.get(award.user_id) : null;

    achievements.push({
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      holder: profile
        ? {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            detail: award?.detail ?? null,
          }
        : null,
    });
  }

  // --- Computed: Board Game Collector ---
  const { data: ownership } = await supabase
    .from("user_game_collection")
    .select("user_id, owned");

  const countByUser = new Map<string, number>();
  for (const row of ownership ?? []) {
    if (!row.owned) continue;
    countByUser.set(row.user_id, (countByUser.get(row.user_id) ?? 0) + 1);
  }

  const topCollector = [...countByUser.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  const collectorProfile = topCollector
    ? profileMap.get(topCollector[0])
    : null;

  achievements.push({
    title: "Board Game Collector",
    description: "Own the most board games in the group",
    icon: "🏆",
    holder: collectorProfile
      ? {
          display_name: collectorProfile.display_name,
          avatar_url: collectorProfile.avatar_url,
          detail: `${topCollector[1]} ${topCollector[1] === 1 ? "game" : "games"} owned`,
        }
      : null,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Achievements
      </h1>

      <div className="space-y-4">
        {achievements.map((a) => (
          <AchievementCard key={a.title} {...a} />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({
  title,
  description,
  icon,
  holder,
}: AchievementDisplay) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl dark:bg-amber-900/30">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>

          {holder ? (
            <div className="mt-3 flex items-center gap-2">
              {holder.avatar_url && (
                <Image
                  src={holder.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {holder.display_name}
              </span>
              {holder.detail && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  — {holder.detail}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm italic text-zinc-400 dark:text-zinc-500">
              No one has claimed this yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
