import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  type AchievementDisplay,
  computeCollectorAchievement,
  computeGameAchievements,
} from "./computed-achievements";

export const dynamic = "force-dynamic";

const PLACE_LABELS = ["1st", "2nd", "3rd"];
const PLACE_COLORS = [
  "text-amber-600 dark:text-amber-400",
  "text-zinc-400 dark:text-zinc-500",
  "text-orange-700 dark:text-orange-500",
];

interface BountyDisplay {
  title: string;
  description: string;
  icon: string;
  claimedBy: { display_name: string; avatar_url: string | null } | null;
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

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, partner_id");

  if (profilesError) {
    console.error("[achievements] Failed to load profiles:", profilesError);
  }

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
      holders: profile
        ? [{
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            detail: award?.detail ?? null,
            category_label: null,
          }]
        : [],
    });
  }

  // --- Computed: Board Game Collector (top 3) ---
  achievements.push(await computeCollectorAchievement(supabase, profileMap));

  // --- Computed: Game-specific achievements ---
  const gameAchievements = await computeGameAchievements(supabase, profileMap);

  // --- Bounties ---
  const { data: dbBounties } = await supabase
    .from("bounties")
    .select("title, description, icon, claimed_by");

  const bounties: BountyDisplay[] = (dbBounties ?? []).map((b) => {
    const profile = b.claimed_by ? profileMap.get(b.claimed_by) : null;
    return {
      title: b.title,
      description: b.description,
      icon: b.icon,
      claimedBy: profile
        ? { display_name: profile.display_name, avatar_url: profile.avatar_url }
        : null,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Achievements
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {achievements.map((a) => (
          <AchievementCard key={a.title} {...a} />
        ))}
      </div>

      {gameAchievements.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Game Awards
          </h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Standout games based on community tier rankings
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {gameAchievements.map((a) => (
              <AchievementCard key={a.title} {...a} />
            ))}
          </div>
        </>
      )}

      <h2 className="mb-4 mt-10 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Bounties
      </h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Open challenges — be the first to claim one
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {bounties.map((b) => (
          <BountyCard key={b.title} {...b} />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({
  title,
  description,
  icon,
  holders,
  ranked,
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

          {holders.length > 0 ? (
            <div className="mt-3 space-y-2">
              {holders.map((holder, i) => (
                <div key={`${holder.display_name}-${i}`} className="flex items-center gap-2">
                  {ranked && holders.length > 1 && (
                    <span className={`text-xs font-bold ${PLACE_COLORS[i] ?? "text-zinc-400"}`}>
                      {PLACE_LABELS[i] ?? `${i + 1}th`}
                    </span>
                  )}
                  {holder.category_label && (
                    <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                      {holder.category_label}
                    </span>
                  )}
                  {holder.avatar_urls && holder.avatar_urls.length > 0 ? (
                    <div className="flex -space-x-2">
                      {holder.avatar_urls.map((url) => (
                        <Image
                          key={url}
                          src={url}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 shrink-0 rounded-full border-2 border-white object-cover dark:border-zinc-900"
                        />
                      ))}
                    </div>
                  ) : holder.avatar_url ? (
                    <Image
                      src={holder.avatar_url}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  ) : null}
                  <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {holder.display_name}
                  </span>
                  {holder.detail && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      — {holder.detail}
                    </span>
                  )}
                </div>
              ))}
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

function BountyCard({ title, description, icon, claimedBy }: BountyDisplay) {
  return (
    <div className={`rounded-lg border p-6 ${
      claimedBy
        ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        : "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50"
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
          {claimedBy ? (
            <div className="mt-3 flex items-center gap-2">
              {claimedBy.avatar_url && (
                <Image
                  src={claimedBy.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {claimedBy.display_name}
              </span>
              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                Claimed
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm font-medium text-red-500 dark:text-red-400">
              Unclaimed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
