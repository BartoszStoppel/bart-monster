export interface Rank {
  name: string;
  minGames: number;
  color: string;
  darkColor: string;
  bold: boolean;
}

export const RANKS: Rank[] = [
  // — Bold ranks (Warden and up) — warm end of spectrum —
  { name: "Warlord",       minGames: 250, bold: true,  color: "bg-red-300 text-red-950",          darkColor: "dark:bg-red-700/40 dark:text-red-200" },
  { name: "Dragonslayer",  minGames: 225, bold: true,  color: "bg-red-100 text-red-800",          darkColor: "dark:bg-red-900/30 dark:text-red-300" },
  { name: "Titan",         minGames: 200, bold: true,  color: "bg-orange-100 text-orange-800",    darkColor: "dark:bg-orange-900/30 dark:text-orange-300" },
  { name: "Overlord",      minGames: 180, bold: true,  color: "bg-amber-100 text-amber-800",      darkColor: "dark:bg-amber-900/30 dark:text-amber-300" },
  { name: "Champion",      minGames: 160, bold: true,  color: "bg-yellow-100 text-yellow-800",    darkColor: "dark:bg-yellow-900/30 dark:text-yellow-300" },
  { name: "Berserker",     minGames: 135, bold: true,  color: "bg-fuchsia-100 text-fuchsia-800",  darkColor: "dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  { name: "Battlemage",    minGames: 115, bold: true,  color: "bg-purple-100 text-purple-800",    darkColor: "dark:bg-purple-900/30 dark:text-purple-300" },
  { name: "Warden",        minGames: 95,  bold: true,  color: "bg-violet-100 text-violet-800",    darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  // — Normal ranks — cool end of spectrum —
  { name: "Paladin",       minGames: 80,  bold: false, color: "bg-indigo-100 text-indigo-800",    darkColor: "dark:bg-indigo-900/30 dark:text-indigo-300" },
  { name: "Crusader",      minGames: 65,  bold: false, color: "bg-blue-100 text-blue-800",        darkColor: "dark:bg-blue-900/30 dark:text-blue-300" },
  { name: "Sentinel",      minGames: 52,  bold: false, color: "bg-sky-100 text-sky-700",          darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Knight",        minGames: 42,  bold: false, color: "bg-teal-100 text-teal-700",        darkColor: "dark:bg-teal-900/30 dark:text-teal-300" },
  { name: "Footman",       minGames: 33,  bold: false, color: "bg-emerald-100 text-emerald-700",  darkColor: "dark:bg-emerald-900/30 dark:text-emerald-300" },
  { name: "Scout",         minGames: 25,  bold: false, color: "bg-green-100 text-green-700",      darkColor: "dark:bg-green-900/30 dark:text-green-300" },
  { name: "Apprentice",    minGames: 18,  bold: false, color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/30 dark:text-slate-300" },
  { name: "Squire",        minGames: 11,  bold: false, color: "bg-slate-100 text-slate-600",      darkColor: "dark:bg-slate-800/20 dark:text-slate-400" },
  { name: "Initiate",      minGames: 0,   bold: false, color: "bg-zinc-100 text-zinc-500",        darkColor: "dark:bg-zinc-800/30 dark:text-zinc-400" },
];

export const ARCHMAGE_RANK: Rank = {
  name: "Archmage",
  minGames: 0,
  bold: true,
  color: "bg-amber-200 text-amber-900",
  darkColor: "dark:bg-amber-800/40 dark:text-amber-200",
};

/**
 * Determine a user's RPG rank based on total games ranked.
 * Admins always get "Archmage" regardless of count.
 */
export function getRank(gamesRanked: number, isAdmin: boolean): Rank {
  if (isAdmin) return ARCHMAGE_RANK;

  for (const rank of RANKS) {
    if (gamesRanked >= rank.minGames) return rank;
  }

  return RANKS[RANKS.length - 1];
}
