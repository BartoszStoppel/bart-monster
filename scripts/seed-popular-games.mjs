import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  const value = trimmed.slice(eqIndex + 1);
  process.env[key] = value;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BGG_API_TOKEN = process.env.BGG_API_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BGG_BASE_URL = "https://boardgamegeek.com/xmlapi2";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/** @type {Array<{bggId: number, category: "party" | "board"}>} */
const POPULAR_GAMES = [
  // Board games
  { bggId: 13, category: "board" },       // Catan
  { bggId: 9209, category: "board" },     // Ticket to Ride
  { bggId: 30549, category: "board" },    // Pandemic
  { bggId: 230802, category: "board" },   // Azul
  { bggId: 266192, category: "board" },   // Wingspan
  { bggId: 68448, category: "board" },    // 7 Wonders
  { bggId: 822, category: "board" },      // Carcassonne
  { bggId: 148228, category: "board" },   // Splendor
  { bggId: 36218, category: "board" },    // Dominion
  { bggId: 167791, category: "board" },   // Terraforming Mars
  { bggId: 174430, category: "board" },   // Gloomhaven
  { bggId: 162886, category: "board" },   // Spirit Island
  { bggId: 237182, category: "board" },   // Root
  { bggId: 10547, category: "board" },    // Betrayal at House on the Hill
  { bggId: 170216, category: "board" },   // Blood Rage
  // Party games
  { bggId: 178900, category: "party" },   // Codenames
  { bggId: 39856, category: "party" },    // Dixit
  { bggId: 70323, category: "party" },    // King of Tokyo
  { bggId: 133473, category: "party" },   // Sushi Go!
  { bggId: 172225, category: "party" },   // Exploding Kittens
  { bggId: 50381, category: "party" },    // Cards Against Humanity
  { bggId: 2223, category: "party" },     // UNO
  { bggId: 74, category: "party" },       // Apples to Apples
  { bggId: 41114, category: "party" },    // The Resistance
  { bggId: 22348, category: "party" },    // Telestrations
];

const HTML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeHtmlEntities(text) {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (match) => HTML_ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function getPrimaryName(name) {
  if (!name) return "Unknown";
  if (Array.isArray(name)) {
    const primary = name.find((n) => n["@_type"] === "primary");
    return primary?.["@_value"] ?? name[0]?.["@_value"] ?? "Unknown";
  }
  return name["@_value"];
}

function parseGameDetails(parsed) {
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
    bggWeight: parseFloat(item.statistics?.ratings?.averageweight?.["@_value"] ?? "0"),
    categories,
    mechanics,
  };
}

async function fetchGameFromBgg(bggId) {
  const url = `${BGG_BASE_URL}/thing?id=${bggId}&stats=1`;
  const headers = {};
  if (BGG_API_TOKEN) {
    headers.Authorization = `Bearer ${BGG_API_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`BGG fetch failed for ${bggId}: ${response.status}`);
  }
  const xml = await response.text();
  const parsed = parser.parse(xml);
  return parseGameDetails(parsed);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Seeding ${POPULAR_GAMES.length} popular games...\n`);

  let success = 0;
  let failed = 0;

  for (const { bggId, category } of POPULAR_GAMES) {
    try {
      const game = await fetchGameFromBgg(bggId);
      if (!game) {
        console.error(`  SKIP: BGG returned no data for ID ${bggId}`);
        failed++;
        continue;
      }

      const { error } = await supabase.from("board_games").upsert(
        {
          bgg_id: game.id,
          name: game.name,
          description: game.description,
          image_url: game.imageUrl,
          thumbnail_url: game.thumbnailUrl,
          year_published: game.yearPublished,
          min_players: game.minPlayers,
          max_players: game.maxPlayers,
          playing_time: game.playingTime,
          min_play_time: game.minPlayTime,
          max_play_time: game.maxPlayTime,
          min_age: game.minAge,
          bgg_rating: game.bggRating,
          bgg_weight: game.bggWeight,
          categories: game.categories,
          mechanics: game.mechanics,
          category,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "bgg_id" }
      );

      if (error) {
        console.error(`  FAIL: ${game.name} — ${error.message}`);
        failed++;
      } else {
        console.log(`  OK: ${game.name} (${game.yearPublished}) [${category}]`);
        success++;
      }
    } catch (err) {
      console.error(`  ERROR: BGG ID ${bggId} — ${err.message}`);
      failed++;
    }

    await sleep(1000);
  }

  console.log(`\nDone! ${success} added, ${failed} failed.`);
}

main();
