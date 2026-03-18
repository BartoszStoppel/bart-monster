import type {
  BggSearchResult,
  BggGameDetails,
  BggPlayerCountPoll,
  BggExpansion,
} from "./types";

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (match) => HTML_ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

interface BggXmlItem {
  "@_id": string;
  "@_type"?: string;
  name?: { "@_value": string } | Array<{ "@_value": string; "@_type": string }>;
  yearpublished?: { "@_value": string };
}

interface BggXmlPollResult {
  "@_value": string;
  "@_numvotes": string;
  "@_level"?: string;
}

interface BggXmlPollResults {
  "@_numplayers"?: string;
  result?: BggXmlPollResult | BggXmlPollResult[];
}

interface BggXmlPoll {
  "@_name": string;
  results?: BggXmlPollResults | BggXmlPollResults[];
}

interface BggXmlLink {
  "@_type": string;
  "@_value": string;
  "@_id"?: string;
}

interface BggXmlThingItem {
  "@_id": string;
  name?: { "@_value": string } | Array<{ "@_value": string; "@_type": string }>;
  description?: string;
  image?: string;
  thumbnail?: string;
  yearpublished?: { "@_value": string };
  minplayers?: { "@_value": string };
  maxplayers?: { "@_value": string };
  playingtime?: { "@_value": string };
  minplaytime?: { "@_value": string };
  maxplaytime?: { "@_value": string };
  minage?: { "@_value": string };
  statistics?: {
    ratings?: {
      average?: { "@_value": string };
      averageweight?: { "@_value": string };
      usersrated?: { "@_value": string };
      stddev?: { "@_value": string };
      owned?: { "@_value": string };
      wanting?: { "@_value": string };
      wishing?: { "@_value": string };
      numweights?: { "@_value": string };
    };
  };
  link?: BggXmlLink | BggXmlLink[];
  poll?: BggXmlPoll | BggXmlPoll[];
}

function getPrimaryName(
  name: { "@_value": string } | Array<{ "@_value": string; "@_type": string }> | undefined
): string {
  if (!name) return "Unknown";
  if (Array.isArray(name)) {
    const primary = name.find((n) => n["@_type"] === "primary");
    return primary?.["@_value"] ?? name[0]?.["@_value"] ?? "Unknown";
  }
  return name["@_value"];
}

function getAlternateNames(
  name: { "@_value": string } | Array<{ "@_value": string; "@_type": string }> | undefined
): string[] {
  if (!name || !Array.isArray(name)) return [];
  return name
    .filter((n) => n["@_type"] === "alternate")
    .map((n) => n["@_value"]);
}

function asArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function linksByType(links: BggXmlLink[], type: string): string[] {
  return links.filter((l) => l["@_type"] === type).map((l) => l["@_value"]);
}

function parseSuggestedPlayers(polls: BggXmlPoll[]): BggPlayerCountPoll[] {
  const poll = polls.find((p) => p["@_name"] === "suggested_numplayers");
  if (!poll) return [];

  const allResults = asArray(poll.results);
  return allResults
    .filter((r) => r["@_numplayers"])
    .map((r) => {
      const results = asArray(r.result);
      const votes = (label: string) =>
        parseInt(
          results.find((v) => v["@_value"] === label)?.["@_numvotes"] ?? "0",
          10
        );
      return {
        numPlayers: r["@_numplayers"]!,
        best: votes("Best"),
        recommended: votes("Recommended"),
        notRecommended: votes("Not Recommended"),
      };
    });
}

function parseSuggestedAge(polls: BggXmlPoll[]): number | null {
  const poll = polls.find((p) => p["@_name"] === "suggested_playerage");
  if (!poll) return null;

  const resultsWrapper = asArray(poll.results)[0];
  if (!resultsWrapper) return null;

  const results = asArray(resultsWrapper.result);
  let maxVotes = 0;
  let bestAge: number | null = null;
  for (const r of results) {
    const votes = parseInt(r["@_numvotes"] ?? "0", 10);
    const age = parseInt(r["@_value"], 10);
    if (votes > maxVotes && !isNaN(age)) {
      maxVotes = votes;
      bestAge = age;
    }
  }
  return bestAge;
}

function parseLanguageDependence(polls: BggXmlPoll[]): string | null {
  const poll = polls.find((p) => p["@_name"] === "language_dependence");
  if (!poll) return null;

  const resultsWrapper = asArray(poll.results)[0];
  if (!resultsWrapper) return null;

  const results = asArray(resultsWrapper.result);
  let maxVotes = 0;
  let topValue: string | null = null;
  for (const r of results) {
    const votes = parseInt(r["@_numvotes"] ?? "0", 10);
    if (votes > maxVotes) {
      maxVotes = votes;
      topValue = r["@_value"];
    }
  }
  return topValue;
}

export function parseSearchResults(
  parsed: { items?: { item?: BggXmlItem | BggXmlItem[] } }
): BggSearchResult[] {
  const items = parsed?.items?.item;
  if (!items) return [];

  const list = Array.isArray(items) ? items : [items];

  return list.map((item) => ({
    id: parseInt(item["@_id"], 10),
    name: getPrimaryName(item.name),
    yearPublished: item.yearpublished
      ? parseInt(item.yearpublished["@_value"], 10)
      : null,
  }));
}

export interface BggThingSummary {
  id: number;
  thumbnailUrl: string;
  minPlayers: number;
  maxPlayers: number;
}

export function parseThingSummaries(
  parsed: { items?: { item?: BggXmlThingItem | BggXmlThingItem[] } }
): BggThingSummary[] {
  const items = parsed?.items?.item;
  if (!items) return [];

  const list = Array.isArray(items) ? items : [items];

  return list.map((item) => ({
    id: parseInt(item["@_id"], 10),
    thumbnailUrl: item.thumbnail ?? "",
    minPlayers: parseInt(item.minplayers?.["@_value"] ?? "0", 10),
    maxPlayers: parseInt(item.maxplayers?.["@_value"] ?? "0", 10),
  }));
}

export function parseGameDetails(
  parsed: { items?: { item?: BggXmlThingItem | BggXmlThingItem[] } }
): BggGameDetails | null {
  const items = parsed?.items?.item;
  if (!items) return null;

  const item = Array.isArray(items) ? items[0] : items;
  if (!item) return null;

  const links = asArray(item.link);
  const polls = asArray(item.poll);
  const ratings = item.statistics?.ratings;

  const expansionLinks = links.filter(
    (l) => l["@_type"] === "boardgameexpansion" && l["@_id"]
  );
  const expansions: BggExpansion[] = expansionLinks.map((l) => ({
    id: parseInt(l["@_id"]!, 10),
    name: l["@_value"],
  }));

  return {
    id: parseInt(item["@_id"], 10),
    name: getPrimaryName(item.name),
    description: item.description ? decodeHtmlEntities(item.description) : "",
    imageUrl: item.image ?? "",
    thumbnailUrl: item.thumbnail ?? "",
    yearPublished: parseInt(item.yearpublished?.["@_value"] ?? "0", 10),
    minPlayers: parseInt(item.minplayers?.["@_value"] ?? "0", 10),
    maxPlayers: parseInt(item.maxplayers?.["@_value"] ?? "0", 10),
    playingTime: parseInt(item.playingtime?.["@_value"] ?? "0", 10),
    minPlayTime: parseInt(item.minplaytime?.["@_value"] ?? "0", 10),
    maxPlayTime: parseInt(item.maxplaytime?.["@_value"] ?? "0", 10),
    minAge: parseInt(item.minage?.["@_value"] ?? "0", 10),
    bggRating: parseFloat(ratings?.average?.["@_value"] ?? "0"),
    bggWeight: parseFloat(ratings?.averageweight?.["@_value"] ?? "0"),
    categories: linksByType(links, "boardgamecategory"),
    mechanics: linksByType(links, "boardgamemechanic"),
    designers: linksByType(links, "boardgamedesigner"),
    artists: linksByType(links, "boardgameartist"),
    publishers: linksByType(links, "boardgamepublisher"),
    expansions,
    suggestedPlayers: parseSuggestedPlayers(polls),
    suggestedAge: parseSuggestedAge(polls),
    languageDependence: parseLanguageDependence(polls),
    bggUsersRated: parseInt(ratings?.usersrated?.["@_value"] ?? "0", 10),
    bggStdDev: parseFloat(ratings?.stddev?.["@_value"] ?? "0"),
    bggOwned: parseInt(ratings?.owned?.["@_value"] ?? "0", 10),
    bggWanting: parseInt(ratings?.wanting?.["@_value"] ?? "0", 10),
    bggWishing: parseInt(ratings?.wishing?.["@_value"] ?? "0", 10),
    bggNumWeights: parseInt(ratings?.numweights?.["@_value"] ?? "0", 10),
    alternateNames: getAlternateNames(item.name),
  };
}
