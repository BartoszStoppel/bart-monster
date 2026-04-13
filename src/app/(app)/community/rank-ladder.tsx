"use client";

import Image from "next/image";
import Link from "next/link";
import { RANKS, ADJECTIVES, getRank, getAdjective, type Rank } from "@/lib/ranks";

const EMPTY_RANK_MESSAGES: Record<string, string> = {
  "Beggar":        "Rank a game and escape this shameful void",
  "Cannon Fodder": "Someone has to go first — why not you?",
  "Initiate":      "The ritual awaits its first volunteer",
  "Peasant":       "A few more games gets you out of the mud",
  "Squire":        "Every knight needs a squire — step up",
  "Acolyte":       "The temple accepts all who rank",
  "Apprentice":    "An apprenticeship is open — apply within",
  "Scout":         "Go explore, report back",
  "Militia":       "The militia is recruiting, no experience needed",
  "Ranger":        "The wilderness calls — answer it",
  "Footman":       "Fall in line, start ranking",
  "Guard":         "This post needs a guard",
  "Knight":        "The sword awaits its owner",
  "Zealot":        "This cause needs a true believer",
  "Sentinel":      "Someone needs to take the watch",
  "Enforcer":      "The law needs enforcing — volunteer",
  "Guardian":      "This post needs a guardian",
  "Stalwart":      "Stand firm, claim this rank",
  "Crusader":      "Join the crusade, start ranking",
  "Templar":       "The order is accepting new members",
  "Vanguard":      "Lead the charge, be the first",
  "Paladin":       "Take up the oath, rank more games",
  "Vindicator":    "Justice needs a champion — step forward",
  "Harbinger":     "Be the one who brings the news",
  "Warden":        "The keep needs its warden",
  "Sorcerer":      "This power remains unclaimed",
  "Invoker":       "The incantation awaits a voice",
  "Marauder":      "Raid more tier lists, take this rank",
  "Gladiator":     "The arena is waiting for its first fighter",
  "Wizard":        "The hat must be earned",
  "Battlemage":    "Sword in one hand, games in the other — go",
  "Berserker":     "Bring the rage, claim this rank",
  "Reaver":        "Pillage your way here",
  "Conqueror":     "New territory to claim — keep ranking",
  "Champion":      "The title awaits a challenger",
  "Warbringer":    "Bring the war, no one else will",
  "Juggernaut":    "Nothing can stop you — prove it",
  "Titan":         "Dare you?",
  "Overlord":      "The throne awaits — seize it",
  "Colossus":      "Rise to this height — we dare you",
  "Dragonslayer":  "No one's brave enough yet",
  "Demigod":       "Divinity awaits the worthy",
  "Archmage":      "The tower stands empty — claim it",
  "Arbiter":       "Someone must pass judgment — will it be you?",
  "Sovereign":     "A crown sits unclaimed",
  "Paragon":       "Perfection awaits — keep going",
  "Ascendant":     "Rise above — no one has yet",
  "Eternal":       "Immortality is earned, not given",
  "Warlord":       "The throne awaits",
};

interface RankUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalGamesRanked: number;
  gamesOwned: number;
  partnerId: string | null;
}

interface RankLadderProps {
  users: RankUser[];
}

/** A display unit — either a single user or a household pair. */
interface DisplayEntry {
  id: string;
  linkUserId: string;
  label: string;
  avatars: (string | null)[];
  count: number;
}

/** Merge partners into household entries. Solo users stay as-is. */
function buildHouseholdEntries(
  members: RankUser[],
  allUsers: Map<string, RankUser>,
  countKey: "totalGamesRanked" | "gamesOwned",
): DisplayEntry[] {
  const seen = new Set<string>();
  const entries: DisplayEntry[] = [];

  for (const user of members) {
    if (seen.has(user.userId)) continue;
    seen.add(user.userId);

    const partner = user.partnerId ? allUsers.get(user.partnerId) : null;
    const partnerInSameGroup = partner && members.some((m) => m.userId === partner.userId);

    if (partnerInSameGroup && partner && !seen.has(partner.userId)) {
      seen.add(partner.userId);
      entries.push({
        id: `${user.userId}-${partner.userId}`,
        linkUserId: user.userId,
        label: `${user.displayName} & ${partner.displayName}`,
        avatars: [user.avatarUrl, partner.avatarUrl],
        count: countKey === "gamesOwned" ? user[countKey] : user[countKey] + partner[countKey],
      });
    } else {
      entries.push({
        id: user.userId,
        linkUserId: user.userId,
        label: user.displayName,
        avatars: [user.avatarUrl],
        count: user[countKey],
      });
    }
  }

  entries.sort((a, b) => b.count - a.count);
  return entries;
}

function rankClasses(rank: Rank): string {
  const weight = rank.bold ? "font-bold" : "font-medium";
  return `${weight} ${rank.color} ${rank.darkColor}`;
}

function EntryRow({ entry }: { entry: DisplayEntry }) {
  return (
    <Link
      href={`/users/${entry.linkUserId}`}
      className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      <div className="flex -space-x-1.5">
        {entry.avatars.map((url, i) =>
          url ? (
            <Image
              key={i}
              src={url}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 rounded-full border-2 border-white object-cover dark:border-zinc-900"
            />
          ) : (
            <div
              key={i}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[10px] font-medium text-zinc-600 dark:border-zinc-900 dark:bg-white/10 dark:text-zinc-300"
            >
              {entry.label.charAt(0).toUpperCase()}
            </div>
          ),
        )}
      </div>
      <span className="text-sm text-zinc-900 dark:text-zinc-100">
        {entry.label}
      </span>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {entry.count}
      </span>
    </Link>
  );
}

function HoldingsColumn({ users, userMap }: { users: RankUser[]; userMap: Map<string, RankUser> }) {
  const groups = new Map<string, RankUser[]>();
  for (const adj of ADJECTIVES) {
    groups.set(adj.name, []);
  }
  for (const user of users) {
    const adj = getAdjective(user.gamesOwned);
    groups.get(adj.name)!.push(user);
  }

  let highestIndex = ADJECTIVES.length - 1;
  for (let i = 0; i < ADJECTIVES.length; i++) {
    if (groups.get(ADJECTIVES[i].name)!.length > 0) {
      highestIndex = i;
      break;
    }
  }
  const visible = ADJECTIVES.slice(highestIndex);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
        Holdings <span className="font-normal">— games owned</span>
      </h3>
      {visible.map((adj) => {
        const members = groups.get(adj.name)!;
        const entries = buildHouseholdEntries(members, userMap, "gamesOwned");
        return (
          <div
            key={adj.name}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/5"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${adj.color} ${adj.darkColor}`}>
                {adj.name}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {adj.minOwned}+ owned
              </span>
            </div>
            <p className="mb-2 text-[11px] italic text-zinc-400 dark:text-zinc-500">
              {adj.tagline}
            </p>
            {entries.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-300 dark:text-zinc-600">
                {adj.emptyMsg}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RenownColumn({ users, userMap }: { users: RankUser[]; userMap: Map<string, RankUser> }) {
  const groups = new Map<string, RankUser[]>();
  for (const rank of RANKS) {
    groups.set(rank.name, []);
  }
  for (const user of users) {
    const rank = getRank(user.totalGamesRanked);
    groups.get(rank.name)!.push(user);
  }

  let highestIndex = RANKS.length - 1;
  for (let i = 0; i < RANKS.length; i++) {
    if (groups.get(RANKS[i].name)!.length > 0) {
      highestIndex = i;
      break;
    }
  }
  const visible = RANKS.slice(highestIndex);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
        Renown <span className="font-normal">— games played</span>
      </h3>
      {visible.map((rank) => {
        const members = groups.get(rank.name)!;
        const entries = buildHouseholdEntries(members, userMap, "totalGamesRanked");
        return (
          <div
            key={rank.name}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/5"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${rankClasses(rank)}`}>
                {rank.name}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {rank.minGames}+ played
              </span>
            </div>
            <p className="mb-2 text-[11px] italic text-zinc-400 dark:text-zinc-500">
              {rank.tagline}
            </p>
            {entries.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-300 dark:text-zinc-600">
                {EMPTY_RANK_MESSAGES[rank.name] ?? "No one here yet"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RankLadder({ users }: RankLadderProps) {
  const userMap = new Map<string, RankUser>();
  for (const user of users) {
    userMap.set(user.userId, user);
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <HoldingsColumn users={users} userMap={userMap} />
      <RenownColumn users={users} userMap={userMap} />
    </div>
  );
}
