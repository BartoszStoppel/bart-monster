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

// Struck-metal place coins — gold/silver/bronze for the podium, tarnished iron
// for everything below. Mirrors the Coin medal pattern in game-card.tsx so a
// ranking reads as minted loot rather than a flat number.
const PLACE_COINS: { bg: string; ring: string }[] = [
  { bg: "radial-gradient(circle at 36% 28%, #ffeec2 0%, #f3bd4e 46%, #9c6614 100%)", ring: "#facc6b" },
  { bg: "radial-gradient(circle at 36% 28%, #fbfbfc 0%, #c5cad0 46%, #6b7177 100%)", ring: "#d4d8dd" },
  { bg: "radial-gradient(circle at 36% 28%, #f4cfa0 0%, #c47b3a 46%, #5f3415 100%)", ring: "#d89a5e" },
];

function PlaceCoin({ index }: { index: number }) {
  const coin = PLACE_COINS[index];
  if (coin) {
    return (
      <span
        title={PLACE_LABELS[index]}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-stat text-[11px] font-bold text-black/75"
        style={{
          background: coin.bg,
          border: `1px solid ${coin.ring}`,
          boxShadow:
            "inset 0 1px 1.5px rgba(255,255,255,0.65), inset 0 -1px 1.5px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        {index + 1}
      </span>
    );
  }
  return (
    <span
      title={`${index + 1}th`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-outline-variant font-stat text-[11px] font-bold text-on-surface-variant"
      style={{
        background: "radial-gradient(circle at 36% 28%, #4a4a4a 0%, #2a2a2a 55%, #141414 100%)",
        boxShadow: "inset 0 1px 1.5px rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {index + 1}
    </span>
  );
}

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
    shameAchievement,
    ...activityAchievements,
    freeloaderAchievement,
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
    <div className="flex flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <h1 className="font-display text-display-lg text-primary">Hall of Trophies</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Medals struck for the bold. Claim a bounty, top a tier list, or earn
          your place among the legends of the table.
        </p>
      </section>

      {achievements.length > 0 && (
        <section className="flex flex-col gap-gutter">
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
            {achievements.map((a) => (
              <AchievementCard key={a.title} {...a} />
            ))}
          </div>
        </section>
      )}

      {peopleAchievements.length > 0 && (
        <section className="flex flex-col gap-gutter">
          <div className="flex flex-col gap-stack-compact">
            <h2 className="font-display text-headline-lg text-on-surface">People Awards</h2>
            <p className="text-on-surface-variant">
              Based on tier list alignment across both categories
            </p>
          </div>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
            {peopleAchievements.map((a) => (
              <AchievementCard key={a.title} {...a} className={a.wide ? "sm:col-span-2" : ""} />
            ))}
          </div>
        </section>
      )}

      {gameAchievements.length > 0 && (
        <section className="flex flex-col gap-gutter">
          <div className="flex flex-col gap-stack-compact">
            <h2 className="font-display text-headline-lg text-on-surface">Game Awards</h2>
            <p className="text-on-surface-variant">
              Standout games based on community tier rankings
            </p>
          </div>
          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
            {gameAchievements.map((a) => (
              <AchievementCard key={a.title} {...a} className={a.wide ? "sm:col-span-2" : ""} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-gutter">
        <div className="flex flex-col gap-stack-compact">
          <h2 className="font-display text-headline-lg text-on-surface">Bounties</h2>
          <p className="text-on-surface-variant">
            Open challenges — be the first to claim one
          </p>
        </div>
        <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
          {bounties.map((b) => (
            <BountyCard key={b.title} {...b} />
          ))}
        </div>
      </section>
    </div>
  );
}

function HolderName({ holder }: { holder: AchievementHolder }) {
  const name = (
    <span className="font-medium text-on-surface">
      {holder.display_name}
    </span>
  );
  if (holder.userId) {
    return (
      <Link href={`/users/${holder.userId}`} className="hover:text-primary">
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
            className="h-6 w-6 shrink-0 rounded-full border-2 border-surface-container-low object-cover"
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
        className="mt-0.5 h-6 w-6 shrink-0 rounded border border-outline-variant object-cover"
      />
    );
  }
  return null;
}

function HoldersList({ holders, ranked, compact }: { holders: AchievementHolder[]; ranked?: boolean; compact?: boolean }) {
  if (compact) {
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
            <div key={`${group.detail}-${currentPlace}`} className="flex items-center gap-2">
              {ranked && <PlaceCoin index={currentPlace} />}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {group.members.map((holder) => (
                  <div key={holder.display_name} className="flex items-center gap-2">
                    <HolderAvatar holder={holder} />
                    <HolderName holder={holder} />
                  </div>
                ))}
              </div>
              {group.detail && (
                <span className="mt-0.5 shrink-0 text-sm text-on-surface-variant">
                  {group.detail}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

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
              <PlaceCoin index={currentPlace} />
              <div className="min-w-0 space-y-1">
                {group.members.map((holder) => (
                  <div key={holder.display_name} className="flex items-center gap-2">
                    <HolderAvatar holder={holder} />
                    <HolderName holder={holder} />
                  </div>
                ))}
                {group.detail && (
                  <p className="text-sm text-on-surface-variant">
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
        <p className="mb-1 text-xs uppercase tracking-wide text-on-surface-variant">
          {sharedDetail}
        </p>
      )}
      {holders.map((holder, i) => (
        <div key={`${holder.display_name}-${i}`} className={`flex items-start gap-2 ${sharedDetail ? "ml-2" : ""}`}>
          {ranked && holders.length > 1 && <PlaceCoin index={i} />}
          {holder.category_label && (
            <span className="mt-0.5 text-xs font-semibold text-on-surface-variant">
              {holder.category_label}
            </span>
          )}
          <HolderAvatar holder={holder} />
          <div className="min-w-0">
            <HolderName holder={holder} />
            {!sharedDetail && holder.detail && (
              <p className="text-sm text-on-surface-variant">
                {holder.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tone tints the medallion behind the icon — slime green for triumphs, blood
// ruby for the walks of shame, torch amber for everything neutral.
const TONE_BADGES: Record<AchievementTone, string> = {
  positive: "border-secondary-container/60 bg-secondary-container/15 text-secondary",
  negative: "border-error/60 bg-error-container/20 text-error",
  neutral: "border-primary/50 bg-primary-container/15 text-primary",
};

const DEFAULT_BADGE = "border-outline-variant bg-primary-container/15 text-primary";

function AchievementCard({
  title,
  description,
  icon,
  holders,
  ranked,
  tone,
  wide,
  className,
}: AchievementDisplay & { className?: string }) {
  const badge = tone ? TONE_BADGES[tone] : DEFAULT_BADGE;

  return (
    <div className={`monster-card rounded-lg p-6 ${className ?? ""}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl ${badge}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-headline-lg-mobile text-on-surface">
            {title}
          </h3>
          <p className="text-sm text-on-surface-variant">
            {description}
          </p>

          {holders.length > 0 ? (
            <HoldersList holders={holders} ranked={ranked} compact={wide} />
          ) : (
            <p className="mt-3 text-sm italic text-on-surface-variant">
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
    <div
      className={`monster-card rounded-lg p-6 ${
        claimedBy ? "" : "border-dashed border-tertiary"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-tertiary/50 bg-tertiary-container/20 text-2xl text-tertiary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-headline-lg-mobile text-on-surface">
            {title}
          </h3>
          <p className="text-sm text-on-surface-variant">
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
                  className="h-6 w-6 rounded-full border border-outline-variant"
                />
              )}
              <span className="font-medium text-on-surface">
                {claimedBy.display_name}
              </span>
              <span className="rune-chip active rounded-full px-2 py-0.5 font-stat text-[10px] uppercase tracking-wide">
                Claimed
              </span>
            </div>
          ) : (
            <p className="mt-3 font-stat text-stat-label uppercase tracking-wide text-tertiary">
              Unclaimed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
