import { XMLParser } from "fast-xml-parser";
import { parseSearchResults, parseGameDetails, parseThingSummaries } from "./parser";
import type { BggSearchResult, BggGameDetails } from "./types";
import type { BggThingSummary } from "./parser";

const BGG_BASE_URL = "https://boardgamegeek.com/xmlapi2";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/**
 * Search BoardGameGeek for games by name.
 * Proxied through our API routes to avoid CORS and keep the token server-side.
 */
export async function searchGames(query: string): Promise<BggSearchResult[]> {
  const url = `${BGG_BASE_URL}/search?query=${encodeURIComponent(query)}&type=boardgame`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.BGG_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`BGG search failed: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  return parseSearchResults(parsed);
}

/**
 * Fetch thumbnail and player count for multiple BGG IDs in a single request.
 */
export async function getThingSummaries(ids: number[]): Promise<BggThingSummary[]> {
  if (ids.length === 0) return [];

  const url = `${BGG_BASE_URL}/thing?id=${ids.join(",")}&type=boardgame`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.BGG_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`BGG batch fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  return parseThingSummaries(parsed);
}

/**
 * Fetch full game details from BoardGameGeek by ID.
 * Includes stats (ratings, weight).
 */
export async function getGameDetails(
  bggId: number
): Promise<BggGameDetails | null> {
  const url = `${BGG_BASE_URL}/thing?id=${bggId}&stats=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.BGG_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`BGG game fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  return parseGameDetails(parsed);
}
