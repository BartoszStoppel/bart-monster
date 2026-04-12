"use client";

import Image from "next/image";
import Link from "next/link";
import { RANKS, getRank, type Rank } from "@/lib/ranks";

const EMPTY_RANK_MESSAGES: Record<string, string> = {
  "Beggar":        "Rank a game and escape this shameful void",
  "Cannon Fodder": "Someone has to go first. Why not you?",
  "Initiate":      "The ritual awaits its first volunteer",
  "Peasant":       "A few more games gets you out of the mud",
  "Squire":        "Every knight needs a squire. Step up.",
  "Acolyte":       "The temple accepts all who rank",
  "Apprentice":    "An apprenticeship is open. Apply within.",
  "Scout":         "Go explore. Report back.",
  "Militia":       "The militia is recruiting. No experience needed.",
  "Ranger":        "The wilderness calls. Answer it.",
  "Footman":       "Fall in line. Start ranking.",
  "Guard":         "This post needs a guard",
  "Knight":        "The sword awaits its owner",
  "Zealot":        "This cause needs a true believer",
  "Sentinel":      "Someone needs to take the watch",
  "Enforcer":      "The law needs enforcing. Volunteer.",
  "Guardian":      "This post needs a guardian",
  "Stalwart":      "Stand firm. Claim this rank.",
  "Crusader":      "Join the crusade. Start ranking.",
  "Templar":       "The order is accepting new members",
  "Vanguard":      "Lead the charge. Be the first.",
  "Paladin":       "Take up the oath. Rank more games.",
  "Vindicator":    "Justice needs a champion. Step forward.",
  "Harbinger":     "Be the one who brings the news",
  "Warden":        "The keep needs its warden",
  "Sorcerer":      "This power remains unclaimed",
  "Invoker":       "The incantation awaits a voice",
  "Marauder":      "Raid more tier lists. Take this rank.",
  "Gladiator":     "The arena is waiting for its first fighter",
  "Wizard":        "The hat must be earned",
  "Battlemage":    "Sword in one hand, games in the other. Go.",
  "Berserker":     "Bring the rage. Claim this rank.",
  "Reaver":        "Pillage your way here",
  "Conqueror":     "New territory to claim. Keep ranking.",
  "Champion":      "The title awaits a challenger",
  "Warbringer":    "Bring the war. No one else will.",
  "Juggernaut":    "Nothing can stop you. Prove it.",
  "Titan":         "Dare you?",
  "Overlord":      "The throne awaits. Seize it.",
  "Colossus":      "Rise to this height. We dare you.",
  "Dragonslayer":  "No one's brave enough. Yet.",
  "Demigod":       "Divinity awaits the worthy",
  "Archmage":      "The tower stands empty. Claim it.",
  "Arbiter":       "Someone must pass judgment. Will it be you?",
  "Sovereign":     "A crown sits unclaimed",
  "Paragon":       "Perfection awaits. Keep going.",
  "Ascendant":     "Rise above. No one has yet.",
  "Eternal":       "Immortality is earned, not given",
  "Warlord":       "The throne awaits",
};

interface RankUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalGamesRanked: number;
}

interface RankLadderProps {
  users: RankUser[];
}

/** Group users by their progression rank (admin status ignored). */
function groupByRank(users: RankUser[]): Map<string, RankUser[]> {
  const groups = new Map<string, RankUser[]>();
  for (const rank of RANKS) {
    groups.set(rank.name, []);
  }
  for (const user of users) {
    const rank = getRank(user.totalGamesRanked);
    groups.get(rank.name)!.push(user);
  }
  // Sort users within each rank by games ranked descending
  for (const members of groups.values()) {
    members.sort((a, b) => b.totalGamesRanked - a.totalGamesRanked);
  }
  return groups;
}

function rankClasses(rank: Rank): string {
  const weight = rank.bold ? "font-bold" : "font-medium";
  return `${weight} ${rank.color} ${rank.darkColor}`;
}

export function RankLadder({ users }: RankLadderProps) {
  const groups = groupByRank(users);

  // Find the highest achieved rank — hide empty ranks above it
  let highestAchievedIndex = RANKS.length - 1;
  for (let i = 0; i < RANKS.length; i++) {
    if (groups.get(RANKS[i].name)!.length > 0) {
      highestAchievedIndex = i;
      break;
    }
  }
  const visibleRanks = RANKS.slice(highestAchievedIndex);

  return (
    <div className="space-y-3">
      {visibleRanks.map((rank) => {
        const members = groups.get(rank.name)!;
        return (
          <div
            key={rank.name}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/5"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${rankClasses(rank)}`}
              >
                {rank.name}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {rank.minGames}+ games ranked
              </span>
            </div>

            {members.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {members.map((user) => (
                  <Link
                    key={user.userId}
                    href={`/users/${user.userId}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.displayName}
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-zinc-900 dark:text-zinc-100">
                      {user.displayName}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {user.totalGamesRanked}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
                {EMPTY_RANK_MESSAGES[rank.name] ?? "No one here yet"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
