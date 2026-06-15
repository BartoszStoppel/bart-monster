export interface Rank {
  name: string;
  minGames: number;
  color: string;
  darkColor: string;
  bold: boolean;
  tagline: string;
}

// Loot-rarity gradient (grim-dark): Common stone → Uncommon slime → Rare arcane-blue
// → Epic violet → Legendary torch-gold, brightening toward the top of each band.
export const RANKS: Rank[] = [
  // — Legendary (torch-gold) —
  { name: "Warlord",       minGames: 300, bold: true,  tagline: "There is nothing left to conquer",                color: "bg-amber-200 text-amber-900",   darkColor: "dark:bg-amber-800/40 dark:text-amber-100" },
  { name: "Eternal",       minGames: 295, bold: true,  tagline: "Time itself bows",                                color: "bg-amber-200 text-amber-900",   darkColor: "dark:bg-amber-800/40 dark:text-amber-100" },
  { name: "Ascendant",     minGames: 290, bold: true,  tagline: "Gravity is optional at this point",               color: "bg-amber-200 text-amber-900",   darkColor: "dark:bg-amber-800/40 dark:text-amber-100" },
  { name: "Paragon",       minGames: 283, bold: true,  tagline: "The standard others are measured against",        color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Sovereign",     minGames: 275, bold: true,  tagline: "Rules by divine right of cardboard",              color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Arbiter",       minGames: 267, bold: true,  tagline: "Judge, jury, and rules lawyer",                   color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Archmage",      minGames: 257, bold: true,  tagline: "Speaks fluent rulebook",                          color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Demigod",       minGames: 247, bold: true,  tagline: "Half mortal, full commitment",                    color: "bg-amber-100 text-amber-700",   darkColor: "dark:bg-amber-900/25 dark:text-amber-300" },
  { name: "Dragonslayer",  minGames: 235, bold: true,  tagline: "Has slain beasts with more pages than some books", color: "bg-amber-100 text-amber-700",   darkColor: "dark:bg-amber-900/25 dark:text-amber-300" },
  { name: "Colossus",      minGames: 223, bold: true,  tagline: "Casts a shadow over the table",                   color: "bg-amber-100 text-amber-700",   darkColor: "dark:bg-amber-900/25 dark:text-amber-300" },
  // — Epic (violet) —
  { name: "Overlord",      minGames: 211, bold: true,  tagline: "Your games fear you",                             color: "bg-violet-200 text-violet-900", darkColor: "dark:bg-violet-800/35 dark:text-violet-200" },
  { name: "Titan",         minGames: 200, bold: true,  tagline: "Reached the realm of myth",                       color: "bg-violet-200 text-violet-900", darkColor: "dark:bg-violet-800/35 dark:text-violet-200" },
  { name: "Juggernaut",    minGames: 189, bold: true,  tagline: "Unstoppable force, immovable opinion",            color: "bg-violet-200 text-violet-900", darkColor: "dark:bg-violet-800/35 dark:text-violet-200" },
  { name: "Warbringer",    minGames: 179, bold: true,  tagline: "Brings war to every game night",                  color: "bg-violet-100 text-violet-800", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Champion",      minGames: 169, bold: true,  tagline: "Has opinions and isn't afraid to rank them",      color: "bg-violet-100 text-violet-800", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Conqueror",     minGames: 159, bold: true,  tagline: "Came, saw, tier-listed",                          color: "bg-violet-100 text-violet-800", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Reaver",        minGames: 149, bold: true,  tagline: "Pillages tier lists for fun",                     color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Berserker",     minGames: 139, bold: true,  tagline: "Ranks in a blind rage",                           color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Battlemage",    minGames: 132, bold: true,  tagline: "Strategy and chaos in equal measure",             color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  // — Rare (arcane blue) —
  { name: "Wizard",        minGames: 127, bold: true,  tagline: "The hat was earned",                              color: "bg-sky-200 text-sky-900",       darkColor: "dark:bg-sky-800/35 dark:text-sky-200" },
  { name: "Gladiator",     minGames: 120, bold: true,  tagline: "Are you not entertained?",                        color: "bg-sky-200 text-sky-900",       darkColor: "dark:bg-sky-800/35 dark:text-sky-200" },
  { name: "Marauder",      minGames: 113, bold: true,  tagline: "Raids game night without mercy",                  color: "bg-sky-200 text-sky-900",       darkColor: "dark:bg-sky-800/35 dark:text-sky-200" },
  { name: "Invoker",       minGames: 107, bold: true,  tagline: "Summons opinions from the void",                  color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Sorcerer",      minGames: 101, bold: true,  tagline: "Triple digits — respect",                          color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Warden",        minGames: 95,  bold: true,  tagline: "Guardian of strong opinions",                     color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Harbinger",     minGames: 90,  bold: false, tagline: "A sign of things to come",                        color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Vindicator",    minGames: 84,  bold: false, tagline: "Proving everyone wrong, one rank at a time",      color: "bg-sky-100 text-sky-700",       darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Paladin",       minGames: 79,  bold: false, tagline: "Noble, righteous, slightly obsessed",             color: "bg-sky-100 text-sky-700",       darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Vanguard",      minGames: 74,  bold: false, tagline: "First to the table, last to leave",               color: "bg-sky-100 text-sky-700",       darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  // — Uncommon (slime green) —
  { name: "Templar",       minGames: 69,  bold: false, tagline: "Sworn an oath to the hobby",                      color: "bg-lime-200 text-lime-900",     darkColor: "dark:bg-lime-800/35 dark:text-lime-200" },
  { name: "Crusader",      minGames: 65,  bold: false, tagline: "On a holy mission to rank everything",            color: "bg-lime-200 text-lime-900",     darkColor: "dark:bg-lime-800/35 dark:text-lime-200" },
  { name: "Stalwart",      minGames: 61,  bold: false, tagline: "Reliable, steady, always ranking",                color: "bg-lime-200 text-lime-900",     darkColor: "dark:bg-lime-800/35 dark:text-lime-200" },
  { name: "Guardian",      minGames: 58,  bold: false, tagline: "Protector of the tier list",                      color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Enforcer",      minGames: 54,  bold: false, tagline: "Does not tolerate unranked games",                color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Sentinel",      minGames: 50,  bold: false, tagline: "Halfway to a hundred — keep watch",               color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Zealot",        minGames: 46,  bold: false, tagline: "Believes in the cause a little too much",         color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Knight",        minGames: 42,  bold: false, tagline: "Earned their spurs at game night",                color: "bg-lime-100 text-lime-700",     darkColor: "dark:bg-lime-900/25 dark:text-lime-300" },
  { name: "Guard",         minGames: 39,  bold: false, tagline: "Standing post, ranking games",                    color: "bg-lime-100 text-lime-700",     darkColor: "dark:bg-lime-900/25 dark:text-lime-300" },
  { name: "Footman",       minGames: 36,  bold: false, tagline: "Marching through the collection",                 color: "bg-lime-100 text-lime-700",     darkColor: "dark:bg-lime-900/25 dark:text-lime-300" },
  // — Common (weathered stone) —
  { name: "Ranger",        minGames: 32,  bold: false, tagline: "Wandering the shelves alone",                     color: "bg-stone-200 text-stone-800",   darkColor: "dark:bg-stone-700/40 dark:text-stone-200" },
  { name: "Militia",       minGames: 28,  bold: false, tagline: "Armed with opinions, lacking training",           color: "bg-stone-200 text-stone-800",   darkColor: "dark:bg-stone-700/40 dark:text-stone-200" },
  { name: "Scout",         minGames: 25,  bold: false, tagline: "Exploring what's out there",                      color: "bg-stone-200 text-stone-800",   darkColor: "dark:bg-stone-700/40 dark:text-stone-200" },
  { name: "Apprentice",    minGames: 21,  bold: false, tagline: "Learning the ancient art of ranking",             color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Acolyte",       minGames: 18,  bold: false, tagline: "A student of the game",                           color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Squire",        minGames: 15,  bold: false, tagline: "Carrying someone else's games to the table",      color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Peasant",       minGames: 11,  bold: false, tagline: "Knows games exist, has played some",              color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Initiate",      minGames: 6,   bold: false, tagline: "Just walked in, still blinking",                  color: "bg-stone-100 text-stone-600",   darkColor: "dark:bg-stone-800/30 dark:text-stone-400" },
  { name: "Cannon Fodder", minGames: 1,   bold: false, tagline: "Warm body at the table",                          color: "bg-stone-100 text-stone-600",   darkColor: "dark:bg-stone-800/30 dark:text-stone-400" },
  { name: "Beggar",        minGames: 0,   bold: false, tagline: "Please sir, may I have a game?",                  color: "bg-stone-100 text-stone-600",   darkColor: "dark:bg-stone-800/30 dark:text-stone-400" },
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
  // — Legendary (torch-gold) —
  { name: "Absolute",      minOwned: 300, tagline: "There is no higher form of ownership",            emptyMsg: "Absolute power owns absolutely",             color: "bg-amber-200 text-amber-900",   darkColor: "dark:bg-amber-800/40 dark:text-amber-100" },
  { name: "Ascended",      minOwned: 298, tagline: "Left the material plane for more shelf space",    emptyMsg: "No one has ascended yet",                    color: "bg-amber-200 text-amber-900",   darkColor: "dark:bg-amber-800/40 dark:text-amber-100" },
  { name: "Otherworldly",  minOwned: 295, tagline: "The collection has transcended physical space",   emptyMsg: "Beyond mortal comprehension",                color: "bg-amber-200 text-amber-900",   darkColor: "dark:bg-amber-800/40 dark:text-amber-100" },
  { name: "Infinite",      minOwned: 290, tagline: "The collection has no end — only beginnings",     emptyMsg: "Infinity is a lot of games",                 color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Ethereal",      minOwned: 283, tagline: "More game than person at this point",             emptyMsg: "Too ethereal for this realm",                color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Cosmic",        minOwned: 275, tagline: "The games have formed their own galaxy",          emptyMsg: "The cosmos remains empty",                   color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Transcendent",  minOwned: 267, tagline: "Has gone beyond mere collecting",                 emptyMsg: "Transcendence requires more cardboard",      color: "bg-amber-100 text-amber-800",   darkColor: "dark:bg-amber-900/35 dark:text-amber-200" },
  { name: "Divine",        minOwned: 257, tagline: "Touched by the board game gods",                  emptyMsg: "The gods are not impressed yet",             color: "bg-amber-100 text-amber-700",   darkColor: "dark:bg-amber-900/25 dark:text-amber-300" },
  { name: "Royal",         minOwned: 247, tagline: "The collection requires its own palace",          emptyMsg: "The palace stands empty",                    color: "bg-amber-100 text-amber-700",   darkColor: "dark:bg-amber-900/25 dark:text-amber-300" },
  { name: "Regal",         minOwned: 235, tagline: "Bows from lesser collectors expected",            emptyMsg: "No one is regal enough",                     color: "bg-amber-100 text-amber-700",   darkColor: "dark:bg-amber-900/25 dark:text-amber-300" },
  // — Epic (violet) —
  { name: "Gilded",        minOwned: 228, tagline: "Everything they touch turns to cardboard",        emptyMsg: "Not enough gold to gild",                    color: "bg-violet-200 text-violet-900", darkColor: "dark:bg-violet-800/35 dark:text-violet-200" },
  { name: "Mythic",        minOwned: 221, tagline: "Their shelf has its own zip code",                emptyMsg: "Myths are made, not born",                   color: "bg-violet-200 text-violet-900", darkColor: "dark:bg-violet-800/35 dark:text-violet-200" },
  { name: "Exalted",       minOwned: 215, tagline: "Worshipped at the altar of cardboard",            emptyMsg: "Exaltation requires more boxes",             color: "bg-violet-200 text-violet-900", darkColor: "dark:bg-violet-800/35 dark:text-violet-200" },
  { name: "Majestic",      minOwned: 208, tagline: "The collection demands a throne room",            emptyMsg: "Majesty can't be rushed",                    color: "bg-violet-100 text-violet-800", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Resplendent",   minOwned: 196, tagline: "The shelf glows with an inner light",             emptyMsg: "Not yet resplendent enough",                 color: "bg-violet-100 text-violet-800", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Legendary",     minOwned: 186, tagline: "Spoken of in whispers at game stores",            emptyMsg: "Legends take time",                          color: "bg-violet-100 text-violet-800", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  { name: "Magnificent",   minOwned: 175, tagline: "The collection is a work of art",                 emptyMsg: "Magnificence awaits a patron",               color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Grandiose",     minOwned: 165, tagline: "Needs a map to navigate the shelves",             emptyMsg: "Grandeur requires inventory",                color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  { name: "Imperial",      minOwned: 156, tagline: "The collection has conquered the house",          emptyMsg: "The empire has no subjects",                  color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/25 dark:text-violet-300" },
  // — Rare (arcane blue) —
  { name: "Extravagant",   minOwned: 148, tagline: "Allergic to an empty shelf",                      emptyMsg: "Extravagance requires commitment",           color: "bg-sky-200 text-sky-900",       darkColor: "dark:bg-sky-800/35 dark:text-sky-200" },
  { name: "Lavish",        minOwned: 139, tagline: "The shelf budget exceeds the food budget",        emptyMsg: "Lavishness is a lifestyle choice",           color: "bg-sky-200 text-sky-900",       darkColor: "dark:bg-sky-800/35 dark:text-sky-200" },
  { name: "Opulent",       minOwned: 131, tagline: "Games in rooms you forgot existed",               emptyMsg: "Opulence is not yet in reach",               color: "bg-sky-200 text-sky-900",       darkColor: "dark:bg-sky-800/35 dark:text-sky-200" },
  { name: "Teeming",       minOwned: 121, tagline: "Games breeding when no one's looking",            emptyMsg: "The shelves are barren",                     color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Overflowing",   minOwned: 111, tagline: "The shelf is a suggestion at this point",         emptyMsg: "Nothing to overflow yet",                    color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Bountiful",     minOwned: 102, tagline: "The harvest of game nights past",                 emptyMsg: "The harvest hasn't come",                    color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Hoarding",      minOwned: 93,  tagline: "Buying games faster than playing them",           emptyMsg: "No one is hoarding yet — suspicious",        color: "bg-sky-100 text-sky-800",       darkColor: "dark:bg-sky-900/30 dark:text-sky-300" },
  { name: "Plentiful",     minOwned: 85,  tagline: "Never short on options",                          emptyMsg: "Plenty of room for someone",                 color: "bg-sky-100 text-sky-700",       darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Amassing",      minOwned: 77,  tagline: "The pile grows — the pile always grows",          emptyMsg: "The pile hasn't started yet",                color: "bg-sky-100 text-sky-700",       darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  { name: "Abundant",      minOwned: 70,  tagline: "More games than excuses not to play",             emptyMsg: "Abundance is still theoretical",             color: "bg-sky-100 text-sky-700",       darkColor: "dark:bg-sky-900/25 dark:text-sky-300" },
  // — Uncommon (slime green) —
  { name: "Wealthy",       minOwned: 63,  tagline: "Rich in cardboard, poor in shelf space",          emptyMsg: "Wealth takes time to accumulate",            color: "bg-lime-200 text-lime-900",     darkColor: "dark:bg-lime-800/35 dark:text-lime-200" },
  { name: "Supplied",      minOwned: 57,  tagline: "Could survive a board game apocalypse",           emptyMsg: "Supply chain issues",                        color: "bg-lime-200 text-lime-900",     darkColor: "dark:bg-lime-800/35 dark:text-lime-200" },
  { name: "Affluent",      minOwned: 51,  tagline: "Has a dedicated game room — probably",            emptyMsg: "The game room is empty",                     color: "bg-lime-200 text-lime-900",     darkColor: "dark:bg-lime-800/35 dark:text-lime-200" },
  { name: "Furnished",     minOwned: 46,  tagline: "The Kallax is earning its keep",                  emptyMsg: "The furniture is lonely",                    color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Prosperous",    minOwned: 41,  tagline: "The Kallax is full, time for another",            emptyMsg: "Prosperity is around the corner",            color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Curated",       minOwned: 37,  tagline: "Every game was chosen with intention — sure",     emptyMsg: "The curator hasn't arrived",                 color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Stocked",       minOwned: 33,  tagline: "Ready for any game night scenario",              emptyMsg: "The stockroom is bare",                      color: "bg-lime-100 text-lime-800",     darkColor: "dark:bg-lime-900/30 dark:text-lime-300" },
  { name: "Gathered",      minOwned: 29,  tagline: "A respectable gathering of cardboard",           emptyMsg: "The gathering hasn't begun",                 color: "bg-lime-100 text-lime-700",     darkColor: "dark:bg-lime-900/25 dark:text-lime-300" },
  { name: "Provisioned",   minOwned: 26,  tagline: "Enough games to survive a long winter",          emptyMsg: "Rations are low",                            color: "bg-lime-100 text-lime-700",     darkColor: "dark:bg-lime-900/25 dark:text-lime-300" },
  { name: "Prepared",      minOwned: 23,  tagline: "Won't be caught empty-handed at game night",     emptyMsg: "Preparation takes planning",                 color: "bg-lime-100 text-lime-700",     darkColor: "dark:bg-lime-900/25 dark:text-lime-300" },
  // — Common (weathered stone) —
  { name: "Resourceful",   minOwned: 20,  tagline: "Makes do with what they've got",                 emptyMsg: "Resources are scarce",                       color: "bg-stone-200 text-stone-800",   darkColor: "dark:bg-stone-700/40 dark:text-stone-200" },
  { name: "Thrifty",       minOwned: 17,  tagline: "Every game was a calculated purchase",           emptyMsg: "Thrift requires something to be thrifty with", color: "bg-stone-200 text-stone-800",   darkColor: "dark:bg-stone-700/40 dark:text-stone-200" },
  { name: "Equipped",      minOwned: 15,  tagline: "Has the essentials covered",                     emptyMsg: "Not equipped yet",                           color: "bg-stone-200 text-stone-800",   darkColor: "dark:bg-stone-700/40 dark:text-stone-200" },
  { name: "Frugal",        minOwned: 12,  tagline: "Stretching every dollar at the game store",      emptyMsg: "Too frugal to exist",                        color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Modest",        minOwned: 10,  tagline: "A curated selection — they'd say",               emptyMsg: "Modesty is the absence of games",            color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Scavenging",    minOwned: 8,   tagline: "Picking up games wherever they can",             emptyMsg: "Nothing left to scavenge",                   color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Humble",        minOwned: 6,   tagline: "It's not much, but it's honest work",            emptyMsg: "Humbly owning nothing",                      color: "bg-stone-200 text-stone-700",   darkColor: "dark:bg-stone-800/40 dark:text-stone-300" },
  { name: "Scrappy",       minOwned: 3,   tagline: "Making it work with three games",                emptyMsg: "Can't be scrappy with nothing",              color: "bg-stone-100 text-stone-600",   darkColor: "dark:bg-stone-800/30 dark:text-stone-400" },
  { name: "Borrowing",     minOwned: 1,   tagline: "Will return it — probably",                      emptyMsg: "Nothing to borrow yet",                      color: "bg-stone-100 text-stone-600",   darkColor: "dark:bg-stone-800/30 dark:text-stone-400" },
  { name: "Destitute",     minOwned: 0,   tagline: "Owns nothing, judges everything",                emptyMsg: "Even destitution requires a person",         color: "bg-stone-100 text-stone-600",   darkColor: "dark:bg-stone-800/30 dark:text-stone-400" },
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
