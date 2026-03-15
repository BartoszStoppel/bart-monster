import type { BggSearchResult, BggGameDetails } from "./types";

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
    };
  };
  link?: Array<{ "@_type": string; "@_value": string }>;
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

  const links = Array.isArray(item.link) ? item.link : [];
  const categories = links
    .filter((l) => l["@_type"] === "boardgamecategory")
    .map((l) => l["@_value"]);
  const mechanics = links
    .filter((l) => l["@_type"] === "boardgamemechanic")
    .map((l) => l["@_value"]);

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
    bggRating: parseFloat(item.statistics?.ratings?.average?.["@_value"] ?? "0"),
    bggWeight: parseFloat(
      item.statistics?.ratings?.averageweight?.["@_value"] ?? "0"
    ),
    categories,
    mechanics,
  };
}
