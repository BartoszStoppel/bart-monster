# Enjoyment and difficulty rankings

This is the accepted product behavior, implemented by the Rust backend and original-style React dashboard. Both metrics use the same consolidated user–game association and retain the daily-history fixes from the earlier implementation.

## Difficulty tiers

| Value | Name | Meaning |
| ---: | --- | --- |
| 1 | Cuddly | Gentle to learn and play; very little rules overhead. |
| 2 | Tame | A few moving parts, approachable after a short explanation. |
| 3 | Challenging | Meaningful rules and decisions that need some attention. |
| 4 | Demanding | Several systems to learn and keep track of. |
| 5 | Brutal | Heavy rules or difficult planning; sustained effort. |
| 6 | Monstrous | The most demanding games in the group. |

Higher means harder. These are fixed scores, unlike enjoyment's relative 10-to-1 normalization. Ordering inside a difficulty tier is visual and does not change its value. Game difficulty and player progression levels are different concepts.

## Independent state and autosave

`hub_usergame` holds enjoyment tier/position/score and separate difficulty tier/position fields. Collection flags, wishlist metadata, explicit ratings, and comments remain independent. A save locks the user and shared games, validates the metric/category revision, and commits placements plus daily history together.

A game ranked in Enjoyment appears in Difficulty's Unranked bank until the player assesses its difficulty. The reverse also applies. This is derived eligibility, not a copied rating or a seeded vote. Existing placements in the other mode remain unchanged. Unranking one mode leaves the other and all collection/comment state intact.

Each completed move autosaves. Serialize requests, retry temporary failures, acknowledge identical retries without writes, and reject different stale revisions. An enjoyment update does not invalidate an otherwise unchanged difficulty revision, and vice versa. Expansion lists remain parent-scoped enjoyment rankings.

## Community and navigation

The Table Monsters presentation and navigation from `9d2a3fb` are restored, with metric controls added where needed. Community independently filters Enjoyment/Difficulty and Board/Party games. A metric switch changes the displayed placements and scores, not the player's earned progression.

Order active players by existing category-specific enjoyment level descending, enjoyment-ranked game count descending, then stable user ID. Difficulty voting does not award duplicate progression. Keep empty states for players without votes in the selected metric. Enjoyment taste comparisons and predictions do not treat difficulty votes as enjoyment preferences.

Hot takes are always highlighted with the red glow. Compare personal values with the chosen metric's community mean for games meeting the three-vote hot-take threshold; break equal absolute deviations by stable game ID. There is no visibility checkbox.

## Authoritative difficulty

Community difficulty is the arithmetic mean of each player's current fixed vote. Show vote counts and label samples below three as early estimates. No votes means **Unrated**. Do not use BGG complexity, enjoyment scores, or descriptions to invent a difficulty number.

Use this value consistently in game details, collection sorting/filtering, statistics, picker easy/hard weighting and restored monster-level badges, and assistant tools. Unknown values sort last and are excluded only by modes that require a known difficulty. BGG's global enjoyment rating remains a separate reference; catalog metadata remains available.

## Daily retention

Both metrics store at most one personal value per player/game/local date and one community mean per game/local date. Each player counts once regardless of editing frequency. Today's value is updated as changes occur; older days stay fixed. There is no nightly job or intraday event table.

Unranking writes a null personal value and recalculates the community from remaining votes; no remaining votes means a null community value. Presentation thresholds do not suppress truthful daily averages. Quiet days carry known values forward in charts; missing imported observations and unranked states remain gaps.

Difficulty history starts with real votes after launch. Do not backfill guessed values. History has no automatic expiry, subject to catalog deletion and the documented backup policy. Account deletion is not exposed by the restored administration UI; any future implementation must preserve the same history invariants. Dates use `America/Indiana/Indianapolis`.

## Storage and verification

`hub_dailyscore.metric` distinguishes personal/community enjoyment and difficulty series. Existing votes/history remain in the private Supabase schema during the Rust transition; there is no re-import. Retired `bgg_weight`/`bgg_num_weights` fields remain only in historical source backups.

Rust regression tests cover fixed difficulty scores, same-tier reorder behavior, metric-scoped revisions, independence during concurrent saves, cross-mode state preservation, decreases, null unranking, and daily uniqueness. Browser checks should exercise both metric selectors, mobile layouts, autosave/reload, red glow eligibility, and unknown difficulty displays. See [verification](refactor-results.md) and [deployment](django-migration.md).
