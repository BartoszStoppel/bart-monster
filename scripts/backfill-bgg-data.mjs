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
  process.env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
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
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const HTML_ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

function decodeHtml(text) {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

function asArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function getPrimaryName(name) {
  if (!name) return "Unknown";
  if (Array.isArray(name)) {
    const primary = name.find((n) => n["@_type"] === "primary");
    return primary?.["@_value"] ?? name[0]?.["@_value"] ?? "Unknown";
  }
  return name["@_value"];
}

function getAlternateNames(name) {
  if (!name || !Array.isArray(name)) return [];
  return name.filter((n) => n["@_type"] === "alternate").map((n) => n["@_value"]);
}

function linksByType(links, type) {
  return links.filter((l) => l["@_type"] === type).map((l) => l["@_value"]);
}

function parseSuggestedPlayers(polls) {
  const poll = polls.find((p) => p["@_name"] === "suggested_numplayers");
  if (!poll) return [];
  return asArray(poll.results)
    .filter((r) => r["@_numplayers"])
    .map((r) => {
      const results = asArray(r.result);
      const votes = (label) =>
        parseInt(results.find((v) => v["@_value"] === label)?.["@_numvotes"] ?? "0", 10);
      return {
        numPlayers: r["@_numplayers"],
        best: votes("Best"),
        recommended: votes("Recommended"),
        notRecommended: votes("Not Recommended"),
      };
    });
}

function parseSuggestedAge(polls) {
  const poll = polls.find((p) => p["@_name"] === "suggested_playerage");
  if (!poll) return null;
  const results = asArray(asArray(poll.results)[0]?.result);
  let maxVotes = 0;
  let bestAge = null;
  for (const r of results) {
    const votes = parseInt(r["@_numvotes"] ?? "0", 10);
    const age = parseInt(r["@_value"], 10);
    if (votes > maxVotes && !isNaN(age)) { maxVotes = votes; bestAge = age; }
  }
  return bestAge;
}

function parseLanguageDependence(polls) {
  const poll = polls.find((p) => p["@_name"] === "language_dependence");
  if (!poll) return null;
  const results = asArray(asArray(poll.results)[0]?.result);
  let maxVotes = 0;
  let topValue = null;
  for (const r of results) {
    const votes = parseInt(r["@_numvotes"] ?? "0", 10);
    if (votes > maxVotes) { maxVotes = votes; topValue = r["@_value"]; }
  }
  return topValue;
}

function parseFullGame(parsed) {
  const items = parsed?.items?.item;
  if (!items) return null;
  const item = Array.isArray(items) ? items[0] : items;
  if (!item) return null;

  const links = asArray(item.link);
  const polls = asArray(item.poll);
  const ratings = item.statistics?.ratings;

  const expansions = links
    .filter((l) => l["@_type"] === "boardgameexpansion" && l["@_id"])
    .map((l) => ({ id: parseInt(l["@_id"], 10), name: l["@_value"] }));

  return {
    name: getPrimaryName(item.name),
    description: item.description ? decodeHtml(item.description) : "",
    image_url: item.image ?? "",
    thumbnail_url: item.thumbnail ?? "",
    year_published: parseInt(item.yearpublished?.["@_value"] ?? "0", 10),
    min_players: parseInt(item.minplayers?.["@_value"] ?? "0", 10),
    max_players: parseInt(item.maxplayers?.["@_value"] ?? "0", 10),
    playing_time: parseInt(item.playingtime?.["@_value"] ?? "0", 10),
    min_play_time: parseInt(item.minplaytime?.["@_value"] ?? "0", 10),
    max_play_time: parseInt(item.maxplaytime?.["@_value"] ?? "0", 10),
    min_age: parseInt(item.minage?.["@_value"] ?? "0", 10),
    bgg_rating: parseFloat(ratings?.average?.["@_value"] ?? "0"),
    bgg_weight: parseFloat(ratings?.averageweight?.["@_value"] ?? "0"),
    categories: linksByType(links, "boardgamecategory"),
    mechanics: linksByType(links, "boardgamemechanic"),
    designers: linksByType(links, "boardgamedesigner"),
    artists: linksByType(links, "boardgameartist"),
    publishers: linksByType(links, "boardgamepublisher"),
    alternate_names: getAlternateNames(item.name),
    expansions,
    bgg_users_rated: parseInt(ratings?.usersrated?.["@_value"] ?? "0", 10) || null,
    bgg_std_dev: parseFloat(ratings?.stddev?.["@_value"] ?? "0") || null,
    bgg_owned: parseInt(ratings?.owned?.["@_value"] ?? "0", 10) || null,
    bgg_wanting: parseInt(ratings?.wanting?.["@_value"] ?? "0", 10) || null,
    bgg_wishing: parseInt(ratings?.wishing?.["@_value"] ?? "0", 10) || null,
    bgg_num_weights: parseInt(ratings?.numweights?.["@_value"] ?? "0", 10) || null,
    suggested_players: parseSuggestedPlayers(polls),
    suggested_age: parseSuggestedAge(polls),
    language_dependence: parseLanguageDependence(polls),
    fetched_at: new Date().toISOString(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { data: games, error } = await supabase
    .from("board_games")
    .select("bgg_id, name");

  if (error) {
    console.error("Failed to fetch games:", error.message);
    process.exit(1);
  }

  console.log(`Backfilling ${games.length} games with extended BGG data...\n`);

  let success = 0;
  let failed = 0;

  for (const { bgg_id, name } of games) {
    try {
      const url = `${BGG_BASE_URL}/thing?id=${bgg_id}&stats=1`;
      const headers = {};
      if (BGG_API_TOKEN) headers.Authorization = `Bearer ${BGG_API_TOKEN}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const xml = await response.text();
      const parsed = parser.parse(xml);
      const data = parseFullGame(parsed);
      if (!data) throw new Error("No data returned");

      const { error: updateError } = await supabase
        .from("board_games")
        .update(data)
        .eq("bgg_id", bgg_id);

      if (updateError) {
        console.error(`  FAIL: ${name} — ${updateError.message}`);
        failed++;
      } else {
        console.log(`  OK: ${name}`);
        success++;
      }
    } catch (err) {
      console.error(`  ERROR: ${name} (${bgg_id}) — ${err.message}`);
      failed++;
    }

    await sleep(1000);
  }

  console.log(`\nDone! ${success} updated, ${failed} failed.`);
}

main();
