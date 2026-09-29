# Supabase efficiency and duplication audit

This report preserves the **September 28, 2026 read-only audit** of the original public application schema. That inspection changed no rows, tables, policies or indexes. Its 14 tables held **11,065 rows and 3.82 MiB** including indexes/TOAST; the reported server was PostgreSQL 17.6. These are historical measurements, not current database totals or projected storage savings.

The approved consolidation was completed during the September 29 cutover. The current Rust application preserves that consolidated data in the existing private `bart_django` schema; `bart_django_preview` isolates previews. These names are historical. Supabase remains PostgreSQL and Google identity, and Vercel runs native Rust. No new legacy import is part of the Rust replacement.

## Current design

- `hub_usergame` combines collection, rating/comment, enjoyment and difficulty state while retaining independent fields, source IDs and timestamps. Ranking never implies ownership. Empty rows can be pruned, but inactive wishlist notes/priority and difficulty-only rows survive.
- `hub_dailyscore` stores one local-day closing value per metric/player/game and one community average per metric/game/day. Same-day updates include decreases, prior days remain unchanged, and each player counts once. The user's daily-granularity request superseded the original intraday history model. No nightly task or automatic history expiry is needed.
- Community comparisons are derived from current rankings rather than stored in a repeated profile/alignments cache. Expansion placements obtain the parent game through their expansion row.
- Activity, achievements/awards, bounties, curated expansions, rulebooks, answer cache and run audit remain separate because their lifecycles differ. Composite unique constraints supply indexes for covered prefix lookups.
- Difficulty adds fields and a history metric to existing tables, with fixed community votes 1–6. There is no duplicate current difficulty-score table or BGG complexity fallback. Raw backups retain retired BGG fields.
- Rust adds only `hub_rustsession` and `hub_chatlease` for secure opaque sessions and expiring cross-instance request coordination. Existing data is not copied into a parallel Rust schema. Database queries use the private role through the Supabase session pooler on port 5432, with one connection per instance and a five-second idle timeout. Shared wrappers disable persistent prepared statements, but live tests showed that this alone does not make SQLx 0.8 safe through the port-6543 transaction pooler.

The historical import merged 1,575 source association rows into 1,143 consolidated rows and compacted 9,085 events into 5,180 historical daily values. It added 1,185 truthful current-day baseline values, without inventing missing past averages. Source exports retain omitted empty rows and every original event. See [data preservation and releases](django-migration.md).

## Original measured inventory

Counts were exact `COUNT(*)` results; sizes used `pg_total_relation_size`. Supabase-managed auth/storage schemas were outside cleanup scope.

| Original public table | Rows | Allocated size |
| --- | ---: | ---: |
| `score_snapshots` | 9,085 | 1,720 KiB |
| `board_games` | 234 | 928 KiB |
| `tier_placements` | 1,006 | 304 KiB |
| `user_alignments` | 42 | 256 KiB |
| `user_game_collection` | 521 | 232 KiB |
| `game_ratings` | 48 | 80 KiB |
| `expansion_tier_placements` | 20 | 64 KiB |
| `game_expansions` | 26 | 64 KiB |
| `user_activity` | 22 | 56 KiB |
| `achievements` | 6 | 48 KiB |
| `bounties` | 7 | 48 KiB |
| `user_achievements` | 11 | 48 KiB |
| `feedback` | 10 | 32 KiB |
| `profiles` | 27 | 32 KiB |

The declared legacy rules tables (`game_rules`, `rules_answer_cache`, `rules_agent_runs`) did not exist in the audited public schema, and their historical migration was not in the live ledger. They were not counted as empty live tables or as storage savings. The current private schema has distinct rulebook/cache/run tables used by Rust.

## Original duplication findings and dispositions

`user_alignments` held 42 derived rows containing repeated profile names/avatars and 246 ally/rival JSON entries. Statistics recorded 9,132 updates to those rows. The active application computes comparisons instead. Keep the legacy table read-only through rollback retention rather than changing its contract in place.

Expansion placement `game_bgg_id` repeated the curated expansion's parent. All 20 values agreed at audit time, but independent foreign keys did not enforce agreement. The consolidated schema derives that parent and validates the ranking scope.

Twenty-eight collection rows had no ownership/wishlist flags, no priority and no nonblank note. They were archived before consolidation. Of 1,575 rows across collection/rating/placement tables, 1,152 distinct user/game pairs existed; 423 repeated pairs were structural duplication, not lost user intent. There were 631 ranked pairs without a collection row, 19 ratings without one, and 46 explicit ratings differed from tier scores. Forty-seven ratings contained comments. These differences are why the merged table keeps independent fields.

Activity stays separate: its 22 rows had 9,980 recorded updates versus 19 profile updates. Combining it with users would couple frequent heartbeats to ranking/user locks. Achievements and single-claim bounties also have different lifecycles. Curated expansions remain separate from refreshable BGG expansion metadata because bank membership is an administrative choice and can include custom entries.

Rulebooks, cached answers and run logs have different invalidation/retention needs. The historical rules migration proposed duplicate indexes covered by unique constraints; the private schema omits those overlaps. Board/party `category` and BGG `categories` are distinct. `playing_time` and `max_play_time` differed for four games, so frequent equality did not justify deleting one.

## Original history defects

No identical same-series/same-timestamp history events or conflicting same-timestamp scores were found. There were **4,667 consecutive equal-score observations at different times** because the old saver rewrote every ranked game. Daily closing values remove that unnecessary granularity while the raw export retains evidence.

The source contained **1,613 downward transitions**. Never compact with daily maxima, discard decreases, or reconstruct older community scores from current placements.

Two defects explained missing chart data:

1. Of 9,085 snapshots, 8,992 were personal; all 93 community snapshots had one April 4 timestamp. The authenticated INSERT policy required `auth.uid() = user_id`, which null community rows could not satisfy. The browser attempted and ignored failed community inserts. Rust computes trusted personal/community values transactionally on the server.
2. The old chart requested up to 50,000 rows in one request, but an audited response returned `Content-Range: 0-999/9085`. A larger client limit did not bypass the API cap. The Rust history endpoint queries the requested series directly in PostgreSQL, with no global 1,000-row truncation.

The legacy score column was NOT NULL and its expected user foreign key was absent. The private daily schema supports explicit unranked/null values and preserves relationships. Catalog deletion removes that game's history. The restored Rust administration UI exposes role management, not account deletion. A future account-deletion implementation must remove personal records safely and refresh today's community means while leaving earlier surviving community days fixed. Preserving history after deliberate identity/catalog deletion would require a separate soft-delete/retained-identity design; setting a deleted user's ID to NULL would falsely label their values as community scores.

## Original integrity and index evidence

- No duplicate association keys, normalized game names, parent-scoped normalized expansion names, or repeated non-null BGG expansion IDs within a parent were found.
- No existing null association keys, null tier scores or negative positions were found, although the legacy schema permitted null keys. The consolidated schema tightens these relationships.
- Three position collisions affected six placements. Explicit ordering/normalization preserved the games instead of deleting colliding rows.
- The initial audit found 96 score differences across seven users, including float-rounding differences; 15 differences across three users remained after excluding tied lists and 0.1 variations. Reconciliation used the canonical formula and recorded current corrections without rewriting historical observations.
- No identical live indexes were found. A game-prefix expansion lookup was covered by its composite unique index, but its scan history meant it was overlapping rather than proven unused. Replacement query plans were checked during consolidation.
- Eight original foreign keys lacked leading-column indexes. At this database size that was not proof of a bottleneck. Retain required uniqueness/history indexes and measure actual queries before deleting or adding indexes.

PostgreSQL creates indexes for unique constraints, and leading columns of multicolumn B-tree indexes can support these filters. See [unique indexes](https://www.postgresql.org/docs/17/indexes-unique.html) and [multicolumn indexes](https://www.postgresql.org/docs/17/indexes-multicolumn.html). These findings are not a latency benchmark or a claim that half the database can be removed safely.

## Retention and reproducibility

Old public tables remain rollback material with API writes frozen. No destructive legacy-table retirement accompanied the original audit or current Rust replacement. Keep the private schema, Supabase Auth, backups and current writes intact. A rollback to the original Next.js deployment requires reconciling newer private-schema writes before restoring old permissions.

[efficiency.sql](../supabase/audits/efficiency.sql) remains a read-only diagnostic for the historical 14-table public schema. It reports counts, sizes, duplicate/empty associations, history repetition, score drift, constraints, policies and indexes inside a transaction that rolls back. It is intentionally outside `supabase/migrations/` and must not be mistaken for a current private-schema migration.

The original audit also used `supabase inspect db table-stats --linked`, `supabase inspect db index-stats --linked`, and the [Management API query endpoint](https://supabase.com/docs/reference/api/v1-run-a-query) with `read_only: true`. Those were separate live observations rather than a frozen snapshot. The September 29 cutover used a frozen export and field-level reconciliation described in [the deployment guide](django-migration.md).
