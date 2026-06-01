// One-time data fix: decode HTML entities (e.g. &#039; → ') that earlier
// imports stored raw in board_games text fields. Read-only by default; pass
// --apply to write changes.
//
//   node scripts/fix-html-entities.mjs            # dry run, reports only
//   node scripts/fix-html-entities.mjs --apply    # writes the fixes
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const HTML_ENTITIES = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

/** Decode named + numeric HTML entities. Idempotent and handles double-encoding. */
function decodeHtml(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

const decodeArray = (arr) => (Array.isArray(arr) ? arr.map(decodeHtml) : arr);

const decodeExpansions = (exps) =>
  Array.isArray(exps)
    ? exps.map((e) => (e && typeof e === "object" ? { ...e, name: decodeHtml(e.name) } : e))
    : exps;

// Columns to decode: scalar text + string arrays + the expansions JSONB.
const TEXT_COLS = ["name", "description"];
const ARRAY_COLS = ["categories", "mechanics", "designers", "artists", "publishers", "alternate_names"];

async function main() {
  const { data: games, error } = await supabase
    .from("board_games")
    .select("bgg_id, name, description, categories, mechanics, designers, artists, publishers, alternate_names, expansions");

  if (error) {
    console.error("Failed to fetch games:", error.message);
    process.exit(1);
  }

  console.log(`${apply ? "APPLYING" : "DRY RUN"} — scanning ${games.length} games\n`);

  let changed = 0;
  let failed = 0;

  for (const game of games) {
    const update = {};

    for (const col of TEXT_COLS) {
      const decoded = decodeHtml(game[col]);
      if (decoded !== game[col]) update[col] = decoded;
    }
    for (const col of ARRAY_COLS) {
      const decoded = decodeArray(game[col]);
      if (JSON.stringify(decoded) !== JSON.stringify(game[col])) update[col] = decoded;
    }
    const decodedExps = decodeExpansions(game.expansions);
    if (JSON.stringify(decodedExps) !== JSON.stringify(game.expansions)) {
      update.expansions = decodedExps;
    }

    if (Object.keys(update).length === 0) continue;

    changed++;
    const before = game.name;
    const after = update.name ?? game.name;
    console.log(`  ${before}${after !== before ? `  →  ${after}` : ""}  [${Object.keys(update).join(", ")}]`);

    if (apply) {
      const { error: updateError } = await supabase
        .from("board_games")
        .update(update)
        .eq("bgg_id", game.bgg_id);
      if (updateError) {
        console.error(`    FAIL: ${updateError.message}`);
        failed++;
      }
    }
  }

  console.log(
    `\n${changed} game(s) ${apply ? "updated" : "would be updated"}` +
      (failed ? `, ${failed} failed` : "") +
      (apply ? "" : "  — rerun with --apply to write changes")
  );
}

main();
