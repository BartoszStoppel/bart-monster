# Supabase efficiency and duplication audit

Audited **2026-09-28**, against the linked live project, cross-checked with the project configured in `.env.local`. PostgreSQL reports version 17.6. This was a read-only inspection; no application rows, tables, indexes, policies, or migrations were changed.

The database is small and mostly well separated: **14 public application tables, 11,065 rows, 3.82 MiB including indexes and TOAST storage**. There is no evidence for halving stored data without discarding useful information. The strongest simplification is retiring the derived alignment table when Django takes over. Correctness and avoidable writes matter more here than disk savings.

## Implementation status after approval

The recommendations are deployed in Django as of September 29, 2026. Vercel serves the application, and the existing Supabase project holds isolated `bart_django` production and `bart_django_preview` schemas. The final frozen export/import was verified field for field. Legacy public tables remain intact with API writes frozen for the rollback window; their eventual retirement is still pending. The inventory below describes the original audit, not current total database disk usage.

- Collection, rating, and game-placement tables are consolidated into `UserGame`. The rehearsal retained 1,143 associations from 1,575 source rows, omitting 28 empty collection associations while retaining independent flags, notes, ratings, and comments. Source IDs/timestamps remain available for reconciliation.
- Alignments are derived; expansion placements store their parent only through the expansion. Overlapping foreign-key indexes are omitted where a composite unique index covers the lookup. Replacement index plans were checked in PostgreSQL.
- Activity, achievements, bounties, curated expansions, rulebooks, caches, and run logs remain separate as recommended. Current scores and ordering are normalized: the rehearsal corrected 91 scores and nine positions using the canonical formula and deterministic tie resolution.
- The subsequent request for **daily granularity supersedes the original intraday-retention recommendation below**. Application history now keeps one daily closing value per player/game and one daily community average, with each player counted once. Today's row updates immediately, so no nightly job is needed. The raw export preserves all original events for rollback.
- The rehearsal compacted 9,085 events into 5,180 historical daily rows and added 1,185 truthful current-day baseline rows. Missing legacy observations remain unknown chart gaps. No past averages were invented.
- Explicit missing-table flags handle the three absent rules tables without masking other export failures. Existing Django installations have a data migration; the source and local database were backed up first.

See [the migration guide](django-migration.md) for implementation, backups, verified counts, and cutover steps, and [the results](refactor-results.md) for tests. The sections below record the original audit and distinguish source findings from the implemented target schema.

The later approved difficulty feature also reuses `UserGame` and adds a metric discriminator to `DailyScore`, keeping the application table count unchanged. The current Django schema removes `bgg_weight` and `bgg_num_weights`; the raw source export retains both. Community difficulty now drives all difficulty consumers, and legacy import explicitly omits those retired fields. These changes are live in the new Django schema; the original audited public tables and historical size measurements remain unchanged in this report. See [the difficulty design](difficulty-rating-plan.md) and [migration guide](django-migration.md#difficulty-schema-upgrade).

## Measured inventory

Counts are exact `COUNT(*)` results. Sizes use `pg_total_relation_size`, including each table's indexes and TOAST; these are allocated relation sizes, not billing totals or estimated reclaimable space. Supabase-managed auth/storage schemas are outside this cleanup scope.

| Table | Rows | Allocated size |
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

The three rules tables in the repository (`game_rules`, `rules_answer_cache`, `rules_agent_runs`) **do not exist in this live public schema**. Migration `20260531000000_game_rules.sql` is absent from the live migration ledger. Do not describe those tables as live, empty tables or include their proposed indexes in live savings.

## Recommended cleanup

| Priority | Change | Evidence and benefit | Conditions |
| --- | --- | --- | --- |
| High | Retire `user_alignments` after the application cutover | All 42 rows are derived from rankings/profiles. It repeats profile names/avatars and stores 246 ally/rival JSON entries. Statistics show 9,132 updates for those 42 rows. Removes a table and the all-user recomputation/write path. | Legacy community/profile/achievement pages still read it. Django already computes comparisons from current placements. Keep the legacy table available during rollback. |
| Medium | Derive the parent game of an expansion placement | `expansion_tier_placements.game_bgg_id` repeats `game_expansions.game_bgg_id`. All 20 rows currently agree, but the two independent foreign keys do not require that agreement. | Django already omits the repeated column and validates it on import. Legacy filters/writes must change before dropping it in Supabase. |
| Low | Remove empty collection associations and stop recreating them | 28 of 521 rows have neither ownership nor wishlist enabled, no priority, and no nonblank note. | These rows still have IDs and `added_at`; archive them before pruning if that timestamp matters. Both save paths must delete only rows meeting the full empty predicate. Preserve inactive rows with notes or priority. No rows were deleted during this audit. |
| Low | Review `idx_game_expansions_game` | Its `game_bgg_id` lookup is also supported by the leading column of the unique `(game_bgg_id, name)` index. Potential saving: only 16 KiB. | It has 233 recorded scans, so this is an overlapping-index candidate, not proven unused. Compare plans before removing it; keep the unique constraint. |

The first two changes are implemented in the deployed Django schema. The old public schema is retained solely for rollback, so changing its contracts separately is unnecessary.

## Table consolidation options

**Collection + ratings + tier placements:** a single `user_games` table is technically possible. The existing tables have 1,575 rows representing 1,152 distinct `(user_id, bgg_id)` pairs; combining them would eliminate 423 repeated associations and two tables. This is a row-count comparison, not a prediction of bytes saved.

This is optional, not the first recommendation. Ownership, wishlist, explicit rating/comment, and relative tier score are independent states. There are 631 ranked pairs without a collection row, 19 ratings without a collection row, and 46 of 48 explicit ratings differ from their tier score. Of the 48 ratings, 47 contain comments. A merger must retain separate `rating` and `score` fields, nullable tier/rating state, original timestamps and legacy IDs for reconciliation, and must not imply that ranking a game means owning it. Unranking must leave ratings and collection flags intact. At this size, the existing three narrow tables are reasonable.

**Activity + profiles:** technically one-to-one, but keep them separate. The 22 activity rows have 9,980 recorded updates versus 19 profile updates. Heartbeats have a different write frequency and would contend with the profile/user rows that Django locks during ranking saves. Saving one small table is not worth coupling those operations.

**Achievements + bounties:** keep separate. They have similar descriptive fields but no identical definitions or shared slugs. Multiple people can receive an achievement; a bounty has its own single-claim state. Django shares their field definitions through an abstract model already.

**Games + expansions / cached BGG expansions:** keep the curated expansion bank separate. All 26 current bank entries happen to reference items in their parent game's BGG JSON, but the JSON is overwritten on refresh and represents available BGG metadata. Bank membership is an admin choice, supports custom entries, and is referenced by rankings. Equality of today's names/IDs does not make those lifecycles interchangeable.

**Rules library + answer cache + run log:** keep separate when introducing the feature. Source rulebooks, disposable cached answers, and historical run records have different retention and invalidation needs. The unapplied SQL migration declares both a unique constraint and an identical lookup index on `(bgg_id, modules_hash, question_norm)`; omit that extra index in any future implementation. Its separate `game_rules(bgg_id)` index also overlaps the unique `(bgg_id, module_name)` index. Django does not apply that legacy migration.

Other apparent duplicates carry different meanings: board-game `category` is the site's board/party split, while `categories` comes from BGG. `playing_time` equals `max_play_time` for 230 games but differs for four and is independently editable/used by the picker. Extended BGG fields are displayed on game detail pages. None should be dropped simply because their values often coincide.

## Original history findings

There are **no identical history events** when grouped by `(user_id, bgg_id, score, snapshot_at)`, and no same-series/same-timestamp conflicting scores. There are **4,667 consecutive equal-score observations at different timestamps**. The legacy saver records every ranked game on every save, even when its score did not change. These are repeated observations, not proven duplicate requests. They remain in the raw export; the approved daily model compacts them by local calendar date.

The saved data contains 1,613 downward transitions. Do not remove them, replace history with daily maxima, or reconstruct past community averages from today's placements. The initial Django rewrite preserved raw events. The approved cleanup now stores daily closing values and retains the raw source export separately.

Two live findings directly affect the chart:

1. **Community history is not being recorded by the normal legacy client path.** There are 8,992 personal snapshots through September 20, but all 93 community snapshots have the single timestamp `2026-04-04 16:00:00+00`. RLS is enabled; the only INSERT policy requires `auth.uid() = user_id`. Community rows have `user_id = NULL`, so they cannot satisfy that check for a normal authenticated client. The legacy `use-tier-save.ts` sends those inserts through the authenticated browser client and ignores their errors. This conclusion follows from the live policy and repository code; no test write was made. Use trusted, transactional server-side aggregation, as in Django, rather than allowing clients to supply arbitrary community scores. [Supabase's RLS reference](https://supabase.com/docs/guides/database/postgres/row-level-security) explains how insert checks apply.
2. **The old chart's single request is truncated.** The legacy statistics page requests up to 50,000 rows ordered oldest first without pagination. A read-only HEAD request with those limits returned `Content-Range: 0-999/9085`: the live API cap is 1,000. Increasing the client limit does not retrieve the rest. Django queries the selected series directly; its importer paginates REST reads until exhausted.

The database also still declares `score_snapshots.score NOT NULL`, so it cannot represent an unranked/null event using the Django convention. Its expected `user_id` foreign key is absent despite the historical migration text; no orphaned snapshot user IDs currently exist. Django's separate daily schema supports null scores and restores the relationship. Deleting a user cascades their personal history; deleting a game cascades all history for that game, as documented in the migration guide. Django admin account deletion refreshes today’s community averages for both metrics without rewriting previous community days. If history must survive deliberate account/catalog deletion too, use soft deletion or a retained identity design in a separate change; setting a deleted user's ID to NULL would falsely label their scores as community history.

## Integrity and index findings

- No duplicate user/game keys in collections, ratings, or placements; no duplicate user/expansion, user/category alignment, or user/achievement pairs. No duplicated normalized game names, normalized expansion names within a parent, or repeated non-null BGG expansion IDs within a parent.
- No null association keys in collections, ratings, placements, or awards; no null tier scores; no negative tier positions. Nevertheless, the legacy schema permits null association keys. Tighten those constraints during migration so future rows cannot evade pair uniqueness.
- All expansion placement parents agree. Profile partners are reciprocal, alignment profile copies currently match, and alignment user/category coverage matches current rankings.
- **Three ranking position collisions** affect six rows across three users. These are duplicate positions, not duplicate games. Resolve the ordering explicitly before normalization; do not delete a game to remove a collision.
- Comparing current saved scores with the repository's 10-to-1 formula finds 96 differences across seven users, including 59 differences of 0.1. Even excluding entire rankings with tied positions and differences of 0.1, **15 scores across three users differ by up to 1.5**. This is evidence of current-score drift worth reconciling; the audit cannot identify when it happened. Preserve past snapshots and record any correction as a new event, not a historical rewrite.
- No exact duplicate live indexes were found. Zero scan counts do not justify dropping primary keys or unique indexes. Database statistics report a reset timestamp of `2025-12-08 11:03:29+00`; individual counters can have different lifetimes. This was not a workload benchmark.
- Eight foreign keys lack an index beginning with their referencing columns, including `tier_placements.bgg_id`, `user_game_collection.bgg_id`, and `expansion_tier_placements.expansion_id`. At 20–1,006 rows these are not automatically bottlenecks. Django creates foreign-key indexes; benchmark actual filters/cascades before adding legacy indexes. Keep the history indexes while evaluating the new chart's filtered workload.

PostgreSQL creates indexes for unique constraints automatically, and leading columns of multicolumn B-tree indexes support those filters. See the [unique-index documentation](https://www.postgresql.org/docs/17/indexes-unique.html) and [multicolumn-index documentation](https://www.postgresql.org/docs/17/indexes-multicolumn.html). Prefix overlap alone does not establish a performance win from dropping an index.

## Cutover and remaining retention

The final export, import, reconciliation, preview verification, and production promotion are complete. Live checks covered autosave/daily history, difficulty, pages, BGG, AI chat/PDF, and Google authorization redirects; completing Google sign-in remains an interactive browser check. Keep the old deployment, private export, and legacy tables through the rollback window. Do not restore the old application without preserving newer Django writes. See the [deployment record](django-migration.md#deployment-record-september-29-2026).

No destructive legacy-table cleanup was applied during the audit, rehearsal, or cutover. The old API write grants and heartbeat RPC execute grants are frozen; Django uses its own private schema. Retiring the legacy tables remains a later operation after rollback retention.

## Reproducing the checks

[efficiency.sql](../supabase/audits/efficiency.sql) is a read-only diagnostic script for the 14-table legacy schema. It includes exact counts, sizes, duplicate checks, empty associations, history repetition, score drift, constraints, policies, and indexes. It uses a read-only transaction and rolls back; it is deliberately outside `supabase/migrations/`. Run it in the linked project's SQL editor or with a trusted PostgreSQL client. It returns aggregates/schema metadata, not names, emails, comments, credentials, or complete user records.

This audit also used `supabase inspect db table-stats --linked`, `supabase inspect db index-stats --linked`, and the [Management API query endpoint](https://supabase.com/docs/reference/api/v1-run-a-query) with `read_only: true`; the database confirmed `transaction_read_only = on`. Catalog/statistics and data checks were separate observations while the app remained live, not a frozen migration snapshot. Historical SQL and legacy readers were reviewed at Git commit `091d2461f1bf47a6b3b78af7d62275050f33bb20`, alongside the current Django models/importer.
