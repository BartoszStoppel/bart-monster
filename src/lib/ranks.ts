export interface Rank {
  name: string;
  minGames: number;
  color: string;
  darkColor: string;
  bold: boolean;
  tagline: string;
}

export const RANKS: Rank[] = [
  // — Bold ranks (Warden and up) — warm end of spectrum —
  { name: "Warlord",       minGames: 300, bold: true,  tagline: "There is nothing left to conquer",                color: "bg-red-300 text-red-950",          darkColor: "dark:bg-red-700/40 dark:text-red-200" },
  { name: "Eternal",       minGames: 295, bold: true,  tagline: "Time itself bows",                                color: "bg-red-200 text-red-900",          darkColor: "dark:bg-red-800/30 dark:text-red-200" },
  { name: "Ascendant",     minGames: 290, bold: true,  tagline: "Gravity is optional at this point",               color: "bg-red-100 text-red-800",          darkColor: "dark:bg-red-900/30 dark:text-red-300" },
  { name: "Paragon",       minGames: 283, bold: true,  tagline: "The standard others are measured against",        color: "bg-rose-100 text-rose-800",        darkColor: "dark:bg-rose-900/30 dark:text-rose-300" },
  { name: "Sovereign",     minGames: 275, bold: true,  tagline: "Rules by divine right of cardboard",              color: "bg-rose-100 text-rose-700",        darkColor: "dark:bg-rose-900/25 dark:text-rose-300" },
  { name: "Arbiter",       minGames: 267, bold: true,  tagline: "Judge, jury, and rules lawyer",                   color: "bg-orange-200 text-orange-900",    darkColor: "dark:bg-orange-800/30 dark:text-orange-200" },
  { name: "Archmage",      minGames: 257, bold: true,  tagline: "Speaks fluent rulebook",                          color: "bg-orange-100 text-orange-800",    darkColor: "dark:bg-orange-900/30 dark:text-orange-300" },
  { name: "Demigod",       minGames: 247, bold: true,  tagline: "Half mortal, full commitment",                    color: "bg-amber-200 text-amber-900",      darkColor: "dark:bg-amber-800/30 dark:text-amber-200" },
  { name: "Dragonslayer",  minGames: 235, bold: true,  tagline: "Has slain beasts with more pages than some books", color: "bg-amber-100 text-amber-800",      darkColor: "dark:bg-amber-900/30 dark:text-amber-300" },
  { name: "Colossus",      minGames: 223, bold: true,  tagline: "Casts a shadow over the table",                   color: "bg-yellow-100 text-yellow-800",    darkColor: "dark:bg-yellow-900/30 dark:text-yellow-300" },
  { name: "Overlord",      minGames: 211, bold: true,  tagline: "Your games fear you",                             color: "bg-yellow-100 text-yellow-700",    darkColor: "dark:bg-yellow-900/25 dark:text-yellow-300" },
  { name: "Titan",         minGames: 200, bold: true,  tagline: "Reached the realm of myth",                       color: "bg-fuchsia-200 text-fuchsia-900",  darkColor: "dark:bg-fuchsia-800/30 dark:text-fuchsia-200" },
  { name: "Juggernaut",    minGames: 189, bold: true,  tagline: "Unstoppable force, immovable opinion",            color: "bg-fuchsia-100 text-fuchsia-800",  darkColor: "dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  { name: "Warbringer",    minGames: 179, bold: true,  tagline: "Brings war to every game night",                  color: "bg-pink-100 text-pink-800",        darkColor: "dark:bg-pink-900/30 dark:text-pink-300" },
  { name: "Champion",      minGames: 169, bold: true,  tagline: "Has opinions and isn't afraid to rank them",      color: "bg-pink-100 text-pink-700",        darkColor: "dark:bg-pink-900/25 dark:text-pink-300" },
  { name: "Conqueror",     minGames: 159, bold: true,  tagline: "Came, saw, tier-listed",                          color: "bg-purple-200 text-purple-900",    darkColor: "dark:bg-purple-800/30 dark:text-purple-200" },
  { name: "Reaver",        minGames: 149, bold: true,  tagline: "Pillages tier lists for fun",                     color: "bg-purple-100 text-purple-800",    darkColor: "dark:bg-purple-900/30 dark:text-purple-300" },
  { name: "Berserker",     minGames: 139, bold: true,  tagline: "Ranks in a blind rage",                           color: "bg-violet-200 text-violet-900",    darkColor: "dark:bg-violet-800/30 dark:text-violet-200" },
  { name: "Battlemage",    minGames: 132, bold: true,  tagline: "Strategy and chaos in equal measure",             color: "bg-violet-100 text-violet-800",    darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Wizard",        minGames: 127, bold: true,  tagline: "The hat was earned",                              color: "bg-violet-100 text-violet-700",    darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Gladiator",     minGames: 120, bold: true,  tagline: "Are you not entertained?",                        color: "bg-indigo-200 text-indigo-900",    darkColor: "dark:bg-indigo-800/30 dark:text-indigo-200" },
  { name: "Marauder",      minGames: 113, bold: true,  tagline: "Raids game night without mercy",                  color: "bg-indigo-100 text-indigo-800",    darkColor: "dark:bg-indigo-900/30 dark:text-indigo-300" },
  { name: "Invoker",       minGames: 107, bold: true,  tagline: "Summons opinions from the void",                  color: "bg-indigo-100 text-indigo-700",    darkColor: "dark:bg-indigo-900/25 dark:text-indigo-300" },
  { name: "Sorcerer",      minGames: 101, bold: true,  tagline: "Triple digits — respect",                          color: "bg-blue-200 text-blue-900",        darkColor: "dark:bg-blue-800/30 dark:text-blue-200" },
  { name: "Warden",        minGames: 95,  bold: true,  tagline: "Guardian of strong opinions",                     color: "bg-blue-100 text-blue-800",        darkColor: "dark:bg-blue-900/30 dark:text-blue-300" },
  // — Normal ranks — cool end of spectrum —
  { name: "Harbinger",     minGames: 90,  bold: false, tagline: "A sign of things to come",                        color: "bg-blue-100 text-blue-700",        darkColor: "dark:bg-blue-900/25 dark:text-blue-300" },
  { name: "Vindicator",    minGames: 84,  bold: false, tagline: "Proving everyone wrong, one rank at a time",      color: "bg-sky-100 text-sky-800",          darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Paladin",       minGames: 79,  bold: false, tagline: "Noble, righteous, slightly obsessed",             color: "bg-sky-100 text-sky-700",          darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Vanguard",      minGames: 74,  bold: false, tagline: "First to the table, last to leave",               color: "bg-teal-100 text-teal-800",        darkColor: "dark:bg-teal-900/30 dark:text-teal-300" },
  { name: "Templar",       minGames: 69,  bold: false, tagline: "Sworn an oath to the hobby",                      color: "bg-teal-100 text-teal-700",        darkColor: "dark:bg-teal-900/25 dark:text-teal-300" },
  { name: "Crusader",      minGames: 65,  bold: false, tagline: "On a holy mission to rank everything",            color: "bg-emerald-100 text-emerald-800",  darkColor: "dark:bg-emerald-900/30 dark:text-emerald-300" },
  { name: "Stalwart",      minGames: 61,  bold: false, tagline: "Reliable, steady, always ranking",                color: "bg-emerald-100 text-emerald-700",  darkColor: "dark:bg-emerald-900/25 dark:text-emerald-300" },
  { name: "Guardian",      minGames: 58,  bold: false, tagline: "Protector of the tier list",                      color: "bg-green-100 text-green-800",      darkColor: "dark:bg-green-900/30 dark:text-green-300" },
  { name: "Enforcer",      minGames: 54,  bold: false, tagline: "Does not tolerate unranked games",                color: "bg-green-100 text-green-700",      darkColor: "dark:bg-green-900/25 dark:text-green-300" },
  { name: "Sentinel",      minGames: 50,  bold: false, tagline: "Halfway to a hundred — keep watch",               color: "bg-green-50 text-green-700",       darkColor: "dark:bg-green-900/20 dark:text-green-400" },
  { name: "Zealot",        minGames: 46,  bold: false, tagline: "Believes in the cause a little too much",         color: "bg-slate-200 text-slate-800",      darkColor: "dark:bg-slate-700/30 dark:text-slate-200" },
  { name: "Knight",        minGames: 42,  bold: false, tagline: "Earned their spurs at game night",                color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/30 dark:text-slate-300" },
  { name: "Guard",         minGames: 39,  bold: false, tagline: "Standing post, ranking games",                    color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/25 dark:text-slate-300" },
  { name: "Footman",       minGames: 36,  bold: false, tagline: "Marching through the collection",                 color: "bg-slate-100 text-slate-600",      darkColor: "dark:bg-slate-800/20 dark:text-slate-400" },
  { name: "Ranger",        minGames: 32,  bold: false, tagline: "Wandering the shelves alone",                     color: "bg-zinc-200 text-zinc-700",        darkColor: "dark:bg-zinc-700/30 dark:text-zinc-300" },
  { name: "Militia",       minGames: 28,  bold: false, tagline: "Armed with opinions, lacking training",           color: "bg-zinc-100 text-zinc-700",        darkColor: "dark:bg-zinc-800/30 dark:text-zinc-300" },
  { name: "Scout",         minGames: 25,  bold: false, tagline: "Exploring what's out there",                      color: "bg-zinc-100 text-zinc-600",        darkColor: "dark:bg-zinc-800/25 dark:text-zinc-400" },
  { name: "Apprentice",    minGames: 21,  bold: false, tagline: "Learning the ancient art of ranking",             color: "bg-zinc-100 text-zinc-600",        darkColor: "dark:bg-zinc-800/20 dark:text-zinc-400" },
  { name: "Acolyte",       minGames: 18,  bold: false, tagline: "A student of the game",                           color: "bg-zinc-100 text-zinc-500",        darkColor: "dark:bg-zinc-800/20 dark:text-zinc-400" },
  { name: "Squire",        minGames: 15,  bold: false, tagline: "Carrying someone else's games to the table",      color: "bg-zinc-50 text-zinc-500",         darkColor: "dark:bg-zinc-800/15 dark:text-zinc-500" },
  { name: "Peasant",       minGames: 11,  bold: false, tagline: "Knows games exist, has played some",              color: "bg-zinc-50 text-zinc-500",         darkColor: "dark:bg-zinc-800/15 dark:text-zinc-500" },
  { name: "Initiate",      minGames: 6,   bold: false, tagline: "Just walked in, still blinking",                  color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-500" },
  { name: "Cannon Fodder", minGames: 1,   bold: false, tagline: "Warm body at the table",                          color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-500" },
  { name: "Beggar",        minGames: 0,   bold: false, tagline: "Please sir, may I have a game?",                  color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-600" },
];

/** Determine a user's RPG rank based on total games ranked. */
export function getRank(gamesRanked: number): Rank {
  for (const rank of RANKS) {
    if (gamesRanked >= rank.minGames) return rank;
  }
  return RANKS[RANKS.length - 1];
}

export interface Adjective {
  name: string;
  minOwned: number;
  color: string;
  darkColor: string;
  tagline: string;
  emptyMsg: string;
}

export const ADJECTIVES: Adjective[] = [
  // — Top tier (300+) —
  { name: "Absolute",      minOwned: 300, tagline: "There is no higher form of ownership",            emptyMsg: "Absolute power owns absolutely",             color: "bg-red-300 text-red-950",          darkColor: "dark:bg-red-700/40 dark:text-red-200" },
  { name: "Ascended",      minOwned: 298, tagline: "Left the material plane for more shelf space",    emptyMsg: "No one has ascended yet",                    color: "bg-red-200 text-red-900",          darkColor: "dark:bg-red-800/30 dark:text-red-200" },
  { name: "Otherworldly",  minOwned: 295, tagline: "The collection has transcended physical space",   emptyMsg: "Beyond mortal comprehension",                color: "bg-red-100 text-red-800",          darkColor: "dark:bg-red-900/30 dark:text-red-300" },
  { name: "Infinite",      minOwned: 290, tagline: "The collection has no end — only beginnings",     emptyMsg: "Infinity is a lot of games",                 color: "bg-rose-100 text-rose-800",        darkColor: "dark:bg-rose-900/30 dark:text-rose-300" },
  { name: "Ethereal",      minOwned: 283, tagline: "More game than person at this point",             emptyMsg: "Too ethereal for this realm",                color: "bg-rose-100 text-rose-700",        darkColor: "dark:bg-rose-900/25 dark:text-rose-300" },
  { name: "Cosmic",        minOwned: 275, tagline: "The games have formed their own galaxy",          emptyMsg: "The cosmos remains empty",                   color: "bg-orange-200 text-orange-900",    darkColor: "dark:bg-orange-800/30 dark:text-orange-200" },
  { name: "Transcendent",  minOwned: 267, tagline: "Has gone beyond mere collecting",                 emptyMsg: "Transcendence requires more cardboard",      color: "bg-orange-100 text-orange-800",    darkColor: "dark:bg-orange-900/30 dark:text-orange-300" },
  { name: "Divine",        minOwned: 257, tagline: "Touched by the board game gods",                  emptyMsg: "The gods are not impressed yet",             color: "bg-amber-200 text-amber-900",      darkColor: "dark:bg-amber-800/30 dark:text-amber-200" },
  { name: "Royal",         minOwned: 247, tagline: "The collection requires its own palace",          emptyMsg: "The palace stands empty",                    color: "bg-amber-100 text-amber-800",      darkColor: "dark:bg-amber-900/30 dark:text-amber-300" },
  { name: "Regal",         minOwned: 235, tagline: "Bows from lesser collectors expected",            emptyMsg: "No one is regal enough",                     color: "bg-yellow-100 text-yellow-800",    darkColor: "dark:bg-yellow-900/30 dark:text-yellow-300" },
  { name: "Gilded",        minOwned: 228, tagline: "Everything they touch turns to cardboard",        emptyMsg: "Not enough gold to gild",                    color: "bg-yellow-100 text-yellow-700",    darkColor: "dark:bg-yellow-900/25 dark:text-yellow-300" },
  { name: "Mythic",        minOwned: 221, tagline: "Their shelf has its own zip code",                emptyMsg: "Myths are made, not born",                   color: "bg-fuchsia-200 text-fuchsia-900",  darkColor: "dark:bg-fuchsia-800/30 dark:text-fuchsia-200" },
  { name: "Exalted",       minOwned: 215, tagline: "Worshipped at the altar of cardboard",            emptyMsg: "Exaltation requires more boxes",             color: "bg-fuchsia-100 text-fuchsia-800",  darkColor: "dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  { name: "Majestic",      minOwned: 208, tagline: "The collection demands a throne room",            emptyMsg: "Majesty can't be rushed",                    color: "bg-pink-100 text-pink-800",        darkColor: "dark:bg-pink-900/30 dark:text-pink-300" },
  { name: "Resplendent",   minOwned: 196, tagline: "The shelf glows with an inner light",             emptyMsg: "Not yet resplendent enough",                 color: "bg-pink-100 text-pink-700",        darkColor: "dark:bg-pink-900/25 dark:text-pink-300" },
  { name: "Legendary",     minOwned: 186, tagline: "Spoken of in whispers at game stores",            emptyMsg: "Legends take time",                          color: "bg-purple-200 text-purple-900",    darkColor: "dark:bg-purple-800/30 dark:text-purple-200" },
  { name: "Magnificent",   minOwned: 175, tagline: "The collection is a work of art",                 emptyMsg: "Magnificence awaits a patron",               color: "bg-purple-100 text-purple-800",    darkColor: "dark:bg-purple-900/30 dark:text-purple-300" },
  { name: "Grandiose",     minOwned: 165, tagline: "Needs a map to navigate the shelves",             emptyMsg: "Grandeur requires inventory",                color: "bg-violet-200 text-violet-900",    darkColor: "dark:bg-violet-800/30 dark:text-violet-200" },
  { name: "Imperial",      minOwned: 156, tagline: "The collection has conquered the house",          emptyMsg: "The empire has no subjects",                  color: "bg-violet-100 text-violet-800",    darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Extravagant",   minOwned: 148, tagline: "Allergic to an empty shelf",                      emptyMsg: "Extravagance requires commitment",           color: "bg-violet-100 text-violet-700",    darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Lavish",        minOwned: 139, tagline: "The shelf budget exceeds the food budget",        emptyMsg: "Lavishness is a lifestyle choice",           color: "bg-indigo-200 text-indigo-900",    darkColor: "dark:bg-indigo-800/30 dark:text-indigo-200" },
  { name: "Opulent",       minOwned: 131, tagline: "Games in rooms you forgot existed",               emptyMsg: "Opulence is not yet in reach",               color: "bg-indigo-100 text-indigo-800",    darkColor: "dark:bg-indigo-900/30 dark:text-indigo-300" },
  { name: "Teeming",       minOwned: 121, tagline: "Games breeding when no one's looking",            emptyMsg: "The shelves are barren",                     color: "bg-indigo-100 text-indigo-700",    darkColor: "dark:bg-indigo-900/25 dark:text-indigo-300" },
  { name: "Overflowing",   minOwned: 111, tagline: "The shelf is a suggestion at this point",         emptyMsg: "Nothing to overflow yet",                    color: "bg-blue-200 text-blue-900",        darkColor: "dark:bg-blue-800/30 dark:text-blue-200" },
  { name: "Bountiful",     minOwned: 102, tagline: "The harvest of game nights past",                 emptyMsg: "The harvest hasn't come",                    color: "bg-blue-100 text-blue-800",        darkColor: "dark:bg-blue-900/30 dark:text-blue-300" },
  { name: "Hoarding",      minOwned: 93,  tagline: "Buying games faster than playing them",           emptyMsg: "No one is hoarding yet — suspicious",        color: "bg-blue-100 text-blue-700",        darkColor: "dark:bg-blue-900/25 dark:text-blue-300" },
  { name: "Plentiful",     minOwned: 85,  tagline: "Never short on options",                          emptyMsg: "Plenty of room for someone",                 color: "bg-sky-100 text-sky-800",          darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Amassing",      minOwned: 77,  tagline: "The pile grows — the pile always grows",          emptyMsg: "The pile hasn't started yet",                color: "bg-sky-100 text-sky-700",          darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Abundant",      minOwned: 70,  tagline: "More games than excuses not to play",             emptyMsg: "Abundance is still theoretical",             color: "bg-teal-100 text-teal-800",        darkColor: "dark:bg-teal-900/30 dark:text-teal-300" },
  { name: "Wealthy",       minOwned: 63,  tagline: "Rich in cardboard, poor in shelf space",          emptyMsg: "Wealth takes time to accumulate",            color: "bg-teal-100 text-teal-700",        darkColor: "dark:bg-teal-900/25 dark:text-teal-300" },
  { name: "Supplied",      minOwned: 57,  tagline: "Could survive a board game apocalypse",           emptyMsg: "Supply chain issues",                        color: "bg-emerald-100 text-emerald-800",  darkColor: "dark:bg-emerald-900/30 dark:text-emerald-300" },
  { name: "Affluent",      minOwned: 51,  tagline: "Has a dedicated game room — probably",            emptyMsg: "The game room is empty",                     color: "bg-emerald-100 text-emerald-700",  darkColor: "dark:bg-emerald-900/25 dark:text-emerald-300" },
  { name: "Furnished",     minOwned: 46,  tagline: "The Kallax is earning its keep",                  emptyMsg: "The furniture is lonely",                    color: "bg-green-100 text-green-800",      darkColor: "dark:bg-green-900/30 dark:text-green-300" },
  { name: "Prosperous",    minOwned: 41,  tagline: "The Kallax is full, time for another",            emptyMsg: "Prosperity is around the corner",            color: "bg-green-100 text-green-700",      darkColor: "dark:bg-green-900/25 dark:text-green-300" },
  { name: "Curated",       minOwned: 37,  tagline: "Every game was chosen with intention — sure",     emptyMsg: "The curator hasn't arrived",                 color: "bg-green-50 text-green-700",       darkColor: "dark:bg-green-900/20 dark:text-green-400" },
  { name: "Stocked",       minOwned: 33,  tagline: "Ready for any game night scenario",              emptyMsg: "The stockroom is bare",                      color: "bg-slate-200 text-slate-800",      darkColor: "dark:bg-slate-700/30 dark:text-slate-200" },
  { name: "Gathered",      minOwned: 29,  tagline: "A respectable gathering of cardboard",           emptyMsg: "The gathering hasn't begun",                 color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/30 dark:text-slate-300" },
  { name: "Provisioned",   minOwned: 26,  tagline: "Enough games to survive a long winter",          emptyMsg: "Rations are low",                            color: "bg-slate-100 text-slate-700",      darkColor: "dark:bg-slate-800/25 dark:text-slate-300" },
  { name: "Prepared",      minOwned: 23,  tagline: "Won't be caught empty-handed at game night",     emptyMsg: "Preparation takes planning",                 color: "bg-slate-100 text-slate-600",      darkColor: "dark:bg-slate-800/20 dark:text-slate-400" },
  { name: "Resourceful",   minOwned: 20,  tagline: "Makes do with what they've got",                 emptyMsg: "Resources are scarce",                       color: "bg-zinc-200 text-zinc-700",        darkColor: "dark:bg-zinc-700/30 dark:text-zinc-300" },
  { name: "Thrifty",       minOwned: 17,  tagline: "Every game was a calculated purchase",           emptyMsg: "Thrift requires something to be thrifty with", color: "bg-zinc-100 text-zinc-700",      darkColor: "dark:bg-zinc-800/30 dark:text-zinc-300" },
  { name: "Equipped",      minOwned: 15,  tagline: "Has the essentials covered",                     emptyMsg: "Not equipped yet",                           color: "bg-zinc-100 text-zinc-600",        darkColor: "dark:bg-zinc-800/25 dark:text-zinc-400" },
  { name: "Frugal",        minOwned: 12,  tagline: "Stretching every dollar at the game store",      emptyMsg: "Too frugal to exist",                        color: "bg-zinc-100 text-zinc-600",        darkColor: "dark:bg-zinc-800/20 dark:text-zinc-400" },
  { name: "Modest",        minOwned: 10,  tagline: "A curated selection — they'd say",               emptyMsg: "Modesty is the absence of games",            color: "bg-zinc-100 text-zinc-500",        darkColor: "dark:bg-zinc-800/20 dark:text-zinc-400" },
  { name: "Scavenging",    minOwned: 8,   tagline: "Picking up games wherever they can",             emptyMsg: "Nothing left to scavenge",                   color: "bg-zinc-50 text-zinc-500",         darkColor: "dark:bg-zinc-800/15 dark:text-zinc-500" },
  { name: "Humble",        minOwned: 6,   tagline: "It's not much, but it's honest work",            emptyMsg: "Humbly owning nothing",                      color: "bg-zinc-50 text-zinc-500",         darkColor: "dark:bg-zinc-800/15 dark:text-zinc-500" },
  { name: "Scrappy",       minOwned: 3,   tagline: "Making it work with three games",                emptyMsg: "Can't be scrappy with nothing",              color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-500" },
  { name: "Borrowing",     minOwned: 1,   tagline: "Will return it — probably",                      emptyMsg: "Nothing to borrow yet",                      color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-500" },
  { name: "Destitute",     minOwned: 0,   tagline: "Owns nothing, judges everything",                emptyMsg: "Even destitution requires a person",         color: "bg-zinc-50 text-zinc-400",         darkColor: "dark:bg-zinc-800/10 dark:text-zinc-600" },
];

/** Determine a user's adjective based on games owned. */
export function getAdjective(gamesOwned: number): Adjective {
  for (const adj of ADJECTIVES) {
    if (gamesOwned >= adj.minOwned) return adj;
  }
  return ADJECTIVES[ADJECTIVES.length - 1];
}

/** Build a full title like "the Hoarding Dragonslayer". */
export function getFullTitle(gamesRanked: number, gamesOwned: number): string {
  const rank = getRank(gamesRanked);
  const adj = getAdjective(gamesOwned);
  return `the ${adj.name} ${rank.name}`;
}
