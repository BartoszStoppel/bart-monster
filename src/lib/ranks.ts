export interface Rank {
  name: string;
  minGames: number;
  color: string;
  darkColor: string;
  bold: boolean;
}

export const RANKS: Rank[] = [
  // — Bold ranks (Warden and up) — warm end of spectrum —
  { name: "Warlord",       minGames: 300, bold: true,  color: "bg-red-300 text-red-950",          darkColor: "dark:bg-red-700/40 dark:text-red-200" },
  { name: "Eternal",       minGames: 295, bold: true,  color: "bg-red-200 text-red-900",          darkColor: "dark:bg-red-800/30 dark:text-red-200" },
  { name: "Ascendant",     minGames: 290, bold: true,  color: "bg-red-100 text-red-800",          darkColor: "dark:bg-red-900/30 dark:text-red-300" },
  { name: "Paragon",       minGames: 283, bold: true,  color: "bg-rose-100 text-rose-800",        darkColor: "dark:bg-rose-900/30 dark:text-rose-300" },
  { name: "Sovereign",     minGames: 275, bold: true,  color: "bg-rose-100 text-rose-700",        darkColor: "dark:bg-rose-900/25 dark:text-rose-300" },
  { name: "Arbiter",       minGames: 267, bold: true,  color: "bg-orange-200 text-orange-900",    darkColor: "dark:bg-orange-800/30 dark:text-orange-200" },
  { name: "Archmage",      minGames: 257, bold: true,  color: "bg-orange-100 text-orange-800",    darkColor: "dark:bg-orange-900/30 dark:text-orange-300" },
  { name: "Demigod",       minGames: 247, bold: true,  color: "bg-amber-200 text-amber-900",      darkColor: "dark:bg-amber-800/30 dark:text-amber-200" },
  { name: "Dragonslayer",  minGames: 235, bold: true,  color: "bg-amber-100 text-amber-800",      darkColor: "dark:bg-amber-900/30 dark:text-amber-300" },
  { name: "Colossus",      minGames: 223, bold: true,  color: "bg-yellow-100 text-yellow-800",    darkColor: "dark:bg-yellow-900/30 dark:text-yellow-300" },
  { name: "Overlord",      minGames: 211, bold: true,  color: "bg-yellow-100 text-yellow-700",    darkColor: "dark:bg-yellow-900/25 dark:text-yellow-300" },
  { name: "Titan",         minGames: 200, bold: true,  color: "bg-fuchsia-200 text-fuchsia-900",  darkColor: "dark:bg-fuchsia-800/30 dark:text-fuchsia-200" },
  { name: "Juggernaut",    minGames: 189, bold: true,  color: "bg-fuchsia-100 text-fuchsia-800",  darkColor: "dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  { name: "Warbringer",    minGames: 179, bold: true,  color: "bg-pink-100 text-pink-800",        darkColor: "dark:bg-pink-900/30 dark:text-pink-300" },
  { name: "Champion",      minGames: 169, bold: true,  color: "bg-pink-100 text-pink-700",        darkColor: "dark:bg-pink-900/25 dark:text-pink-300" },
  { name: "Conqueror",     minGames: 159, bold: true,  color: "bg-purple-200 text-purple-900",    darkColor: "dark:bg-purple-800/30 dark:text-purple-200" },
  { name: "Reaver",        minGames: 149, bold: true,  color: "bg-purple-100 text-purple-800",    darkColor: "dark:bg-purple-900/30 dark:text-purple-300" },
  { name: "Berserker",     minGames: 139, bold: true,  color: "bg-violet-200 text-violet-900",    darkColor: "dark:bg-violet-800/30 dark:text-violet-200" },
  { name: "Battlemage",    minGames: 132, bold: true,  color: "bg-violet-100 text-violet-800",    darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Wizard",        minGames: 127, bold: true,  color: "bg-violet-100 text-violet-700",    darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Gladiator",     minGames: 120, bold: true,  color: "bg-indigo-200 text-indigo-900",    darkColor: "dark:bg-indigo-800/30 dark:text-indigo-200" },
  { name: "Marauder",      minGames: 113, bold: true,  color: "bg-indigo-100 text-indigo-800",    darkColor: "dark:bg-indigo-900/30 dark:text-indigo-300" },
  { name: "Invoker",       minGames: 107, bold: true,  color: "bg-indigo-100 text-indigo-700",    darkColor: "dark:bg-indigo-900/25 dark:text-indigo-300" },
  { name: "Sorcerer",      minGames: 101, bold: true,  color: "bg-blue-200 text-blue-900",        darkColor: "dark:bg-blue-800/30 dark:text-blue-200" },
  { name: "Warden",        minGames: 95,  bold: true,  color: "bg-blue-100 text-blue-800",        darkColor: "dark:bg-blue-900/30 dark:text-blue-300" },
  // — Normal ranks — cool end of spectrum —
  { name: "Harbinger",     minGames: 90,  bold: false, color: "bg-blue-100 text-blue-700",        darkColor: "dark:bg-blue-900/25 dark:text-blue-300" },
  { name: "Vindicator",    minGames: 84,  bold: false, color: "bg-sky-100 text-sky-800",          darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Paladin",       minGames: 79,  bold: false, color: "bg-sky-100 text-sky-700",          darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Vanguard",      minGames: 74,  bold: false, color: "bg-teal-100 text-teal-800",        darkColor: "dark:bg-teal-900/30 dark:text-teal-300" },
  { name: "Templar",       minGames: 69,  bold: false, color: "bg-teal-100 text-teal-700",        darkColor: "dark:bg-teal-900/25 dark:text-teal-300" },
  { name: "Crusader",      minGames: 65,  bold: false, color: "bg-emerald-100 text-emerald-800",  darkColor: "dark:bg-emerald-900/30 dark:text-emerald-300" },
  { name: "Stalwart",      minGames: 61,  bold: false, color: "bg-emerald-100 text-emerald-700",  darkColor: "dark:bg-emerald-900/25 dark:text-emerald-300" },
  { name: "Guardian",      minGames: 58,  bold: false, color: "bg-green-100 text-green-800",      darkColor: "dark:bg-green-900/30 dark:text-green-300" },
  { name: "Enforcer",      minGames: 54,  bold: false, color: "bg-green-100 text-green-700",      darkColor: "dark:bg-green-900/25 dark:text-green-300" },
  { name: "Sentinel",      minGames: 50,  bold: false, color: "bg-green-50 text-green-700",       darkColor: "dark:bg-green-900/20 dark:text-green-400" },
  { name: "Zealot",        minGames: 46,  bold: false, color: "bg-slate-200 text-slate-800",      darkColor: "dark:bg-slate-700/30 dark:text-slate-200" },
  { name: "Knight",        minGames: 42,  bold: false, color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/30 dark:text-slate-300" },
  { name: "Guard",         minGames: 39,  bold: false, color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/25 dark:text-slate-300" },
  { name: "Footman",       minGames: 36,  bold: false, color: "bg-slate-100 text-slate-600",      darkColor: "dark:bg-slate-800/20 dark:text-slate-400" },
  { name: "Ranger",        minGames: 32,  bold: false, color: "bg-zinc-200 text-zinc-700",        darkColor: "dark:bg-zinc-700/30 dark:text-zinc-300" },
  { name: "Militia",       minGames: 28,  bold: false, color: "bg-zinc-100 text-zinc-700",        darkColor: "dark:bg-zinc-800/30 dark:text-zinc-300" },
  { name: "Scout",         minGames: 25,  bold: false, color: "bg-zinc-100 text-zinc-600",        darkColor: "dark:bg-zinc-800/25 dark:text-zinc-400" },
  { name: "Apprentice",    minGames: 21,  bold: false, color: "bg-zinc-100 text-zinc-600",        darkColor: "dark:bg-zinc-800/20 dark:text-zinc-400" },
  { name: "Acolyte",       minGames: 18,  bold: false, color: "bg-zinc-100 text-zinc-500",        darkColor: "dark:bg-zinc-800/20 dark:text-zinc-400" },
  { name: "Squire",        minGames: 15,  bold: false, color: "bg-zinc-50 text-zinc-500",         darkColor: "dark:bg-zinc-800/15 dark:text-zinc-500" },
  { name: "Peasant",       minGames: 11,  bold: false, color: "bg-zinc-50 text-zinc-500",         darkColor: "dark:bg-zinc-800/15 dark:text-zinc-500" },
  { name: "Initiate",      minGames: 6,   bold: false, color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-500" },
  { name: "Cannon Fodder", minGames: 1,   bold: false, color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-500" },
  { name: "Beggar",        minGames: 0,   bold: false, color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-600" },
];

/** Determine a user's RPG rank based on total games ranked. */
export function getRank(gamesRanked: number): Rank {
  for (const rank of RANKS) {
    if (gamesRanked >= rank.minGames) return rank;
  }
  return RANKS[RANKS.length - 1];
}
