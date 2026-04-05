import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  type AchievementDisplay,
  type AchievementHolder,
  type AchievementTone,
  computeCollectorAchievements,
  computeGameAchievements,
  computePeopleAchievements,
} from "./computed-achievements";
import { computeActivityAchievements } from "./activity-achievements";

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
    const awards = (userAchievements ?? []).filter(
      (ua) => ua.achievement_id === achievement.id
    );

    achievements.push({
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      holders: awards
        .map((award) => {
          const profile = profileMap.get(award.user_id);
          if (!profile) return null;
          return {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            detail: award.detail ?? null,
            category_label: null,
            userId: award.user_id,
          };
        })
        .filter((h): h is NonNullable<typeof h> => h !== null),
    });
  }

  // --- Computed: People achievements (alignment-based + collector + activity) ---
  const [collectorAchievement, freeloaderAchievement, shameAchievement] = await computeCollectorAchievements(supabase, profileMap);
  const activityAchievements = await computeActivityAchievements(supabase, profileMap);
  const peopleAchievements = [
    ...(await computePeopleAchievements(supabase, profileMap)),
    collectorAchievement,
    freeloaderAchievement,
    shameAchievement,
    ...activityAchievements,
  ];

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

      {peopleAchievements.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            People Awards
          </h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Based on tier list alignment across both categories
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {peopleAchievements.map((a) => (
              <AchievementCard key={a.title} {...a} />
            ))}
          </div>
        </>
      )}

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
              <AchievementCard key={a.title} {...a} className={a.wide ? "sm:col-span-2" : ""} />
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

function HolderName({ holder }: { holder: AchievementHolder }) {
  const name = (
    <span className="font-medium text-zinc-900 dark:text-zinc-100">
      {holder.display_name}
    </span>
  );
  if (holder.userId) {
    return (
      <Link href={`/users/${holder.userId}`} className="hover:text-blue-600 dark:hover:text-blue-400">
        {name}
      </Link>
    );
  }
  return name;
}

function HolderAvatar({ holder }: { holder: AchievementHolder }) {
  if (holder.avatar_urls && holder.avatar_urls.length > 0) {
    return (
      <div className="mt-0.5 flex -space-x-2">
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
    );
  }
  if (holder.avatar_url) {
    return (
      <Image
        src={holder.avatar_url}
        alt=""
        width={24}
        height={24}
        className="mt-0.5 h-6 w-6 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-700"
      />
    );
  }
  return null;
}

function HoldersList({ holders, ranked }: { holders: AchievementHolder[]; ranked?: boolean }) {
  const sharedDetail =
    holders.length > 1 &&
    holders[0].detail &&
    holders.every((h) => h.detail === holders[0].detail)
      ? holders[0].detail
      : null;

  // Group holders by detail value for tie handling in ranked lists
  if (ranked && holders.length > 1 && !sharedDetail) {
    const groups: { detail: string | null; members: AchievementHolder[] }[] = [];
    for (const holder of holders) {
      const last = groups[groups.length - 1];
      if (last && last.detail === holder.detail) {
        last.members.push(holder);
      } else {
        groups.push({ detail: holder.detail, members: [holder] });
      }
    }

    let placeIndex = 0;
    return (
      <div className="mt-3 space-y-2">
        {groups.map((group) => {
          const currentPlace = placeIndex;
          placeIndex += 1;
          return (
            <div key={`${group.detail}-${currentPlace}`} className="flex items-start gap-2">
              <span className={`mt-0.5 text-xs font-bold ${PLACE_COLORS[currentPlace] ?? "text-zinc-400"}`}>
                {PLACE_LABELS[currentPlace] ?? `${currentPlace + 1}th`}
              </span>
              <div className="min-w-0 space-y-1">
                {group.members.map((holder) => (
                  <div key={holder.display_name} className="flex items-center gap-2">
                    <HolderAvatar holder={holder} />
                    <HolderName holder={holder} />
                  </div>
                ))}
                {group.detail && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {group.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {sharedDetail && (
        <p className="mb-1 text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {sharedDetail}
        </p>
      )}
      {holders.map((holder, i) => (
        <div key={`${holder.display_name}-${i}`} className={`flex items-start gap-2 ${sharedDetail ? "ml-2" : ""}`}>
          {ranked && holders.length > 1 && (
            <span className={`mt-0.5 text-xs font-bold ${PLACE_COLORS[i] ?? "text-zinc-400"}`}>
              {PLACE_LABELS[i] ?? `${i + 1}th`}
            </span>
          )}
          {holder.category_label && (
            <span className="mt-0.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              {holder.category_label}
            </span>
          )}
          <HolderAvatar holder={holder} />
          <div className="min-w-0">
            <HolderName holder={holder} />
            {!sharedDetail && holder.detail && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {holder.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const TONE_STYLES: Record<AchievementTone, { card: string; badge: string }> = {
  positive: {
    card: "border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20",
    badge: "bg-green-100 dark:bg-green-900/30",
  },
  negative: {
    card: "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20",
    badge: "bg-red-100 dark:bg-red-900/30",
  },
  neutral: {
    card: "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/40 dark:bg-yellow-950/20",
    badge: "bg-yellow-100 dark:bg-yellow-900/30",
  },
};

const DEFAULT_STYLE = {
  card: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
  badge: "bg-amber-100 dark:bg-amber-900/30",
};

function AchievementCard({
  title,
  description,
  icon,
  holders,
  ranked,
  tone,
  className,
}: AchievementDisplay & { className?: string }) {
  const styles = tone ? TONE_STYLES[tone] : DEFAULT_STYLE;

  return (
    <div className={`rounded-lg border p-6 ${styles.card} ${className ?? ""}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${styles.badge}`}>
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
            <HoldersList holders={holders} ranked={ranked} />
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
