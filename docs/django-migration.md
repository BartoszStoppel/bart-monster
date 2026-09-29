# Next.js → Django migration and database cleanup

The old runtime remains in Git at `091d2461f1bf47a6b3b78af7d62275050f33bb20`. Django, the approved database cleanup, difficulty rankings, and both review passes went live at https://bart.monster on September 29, 2026. Vercel runs the application; Supabase remains the database and sign-in provider. Preview validation preceded a frozen final export, verified import, and production promotion. Legacy tables and the old deployment remain available for rollback.

## Retained capabilities

| Capability | Django implementation |
| --- | --- |
| Google sign-in and original profile UUIDs | Supabase PKCE, UUID Django users, server-side sessions |
| Catalog, categories, extended BGG metadata | `Game`, cached XML client, search/add/refresh views |
| Ownership, wishlists, priority, notes | Independent fields on `UserGame`, consistent connected-partner household reads |
| Explicit 1–10 ratings and comments | Independent `UserGame.rating` and `comment` fields |
| Game tiers and ordering | `UserGame.tier`, position, and server-computed score |
| Curated expansion tiers | `Expansion`, `ExpansionPlacement`; parent game derived once |
| Difficulty tiers | Independent fixed 1–6 fields on `UserGame`; community mean replaces BGG difficulty |
| Score history | `DailyScore`, one value per metric/series/local day |
| Community comparisons and hot takes | Computed from current rankings; automatic red glow |
| Picker, statistics, awards, bounties, feedback, Furtch | Existing views, data and permissions retained |
| Rules library, PDF conversion and chat | Rulebooks, answer cache, and audit records remain separate |

The user–game consolidation removes two physical application tables without conflating ownership, wishlist, explicit rating, and relative tier score. Removing a tier placement clears only ranking fields. A row is deleted only when it has no flags, wishlist metadata, rating/comment, or tier. Activity stays separate from the user row so heartbeats do not contend with ranking saves. Achievements, awards, bounties, and curated expansion membership remain separate.

Stored `user_alignments` are unnecessary: Django computes them from current placements. Expansion placements do not duplicate their parent game. Leading-column indexes already covered by unique constraints are omitted for expansions, rulebooks, cached answers, and `UserGame.user_id`; needed game/history indexes and uniqueness remain. PostgreSQL query plans verified that expansion/rulebook/cache game lookups can use their composite unique indexes.

## Daily history semantics

Rankings still autosave immediately, with serialized requests, revision checks, retries, and no page reload. For each metric, history keeps **one daily closing value per player/game and one community average per game/day**. A community value averages each player's latest saved score once; it is not an average of all their edits. Today's row is updated as scores change. When the local date changes, subsequent edits create a new day's row. Older days are untouched.

There is no nightly job. Quiet days carry the previous known score forward in the chart without creating redundant rows. Same-day intermediate events are intentionally no longer stored, following the request for daily granularity. No-op saves do not add history. A lost-response retry is idempotent. Unranking records a null daily score and recomputes the community average, preserving older days and independent collection/rating fields.

Dates use `America/Indiana/Indianapolis`. The chart defaults to community averages; player history remains selectable. It shows decreases and signed changes. Imported daily rows are marked as imported so missing legacy observations produce **Unknown** gaps instead of a misleading flat line. Once Django is recording changes, unchanged days can be carried forward reliably. Daily records have no automatic expiry or global cap.

This history covers enjoyment and difficulty game tier scores. Standalone ratings/comments, expansion tiers, and BGG metadata retain current values without this history. Deleting a catalog game/user cascades its associated daily records. Admin account deletion recomputes today’s community values for both metrics from surviving votes, retaining earlier community rows. Backups remain necessary for recovery from deliberate deletion.

## Back up before migrating

Keep the **existing Supabase PostgreSQL database**. Before migrating, provision a private Django schema and a dedicated database role whose search path and privileges target that schema. Keep it outside the exposed Data API schemas, with no access for browser-facing `anon` or `authenticated` roles. Do not apply Django migrations to the legacy `public` schema or Supabase-managed `auth`/`storage` schemas. This isolation was provisioned and verified for production (`bart_django`) and preview (`bart_django_preview`); Django migrations do not create the roles/schemas automatically. Supabase remains the identity provider after cutover.

Django connects through `DATABASE_URL` using PostgreSQL credentials, independently of the Supabase API keys used for sign-in/export. Follow [Supabase's connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) for the selected runtime and [Data API hardening guidance](https://supabase.com/docs/guides/database/hardening-data-api) for schema exposure. Verify the connected role, effective search path, schema permissions, and pooling behavior before applying migrations. The deployed runtime uses the transaction pooler on port 6543 with zero persistent connection age, prepared statements disabled, and server-side cursors disabled. Migration/import connections use the session pooler on port 5432. Both connection paths were checked for the intended user and search path. Dedicated roles use UTC and full floating-point output precision; existing pooled connections may retain their earlier display setting until recycled.

[Vercel supports Django](https://vercel.com/docs/frameworks/full-stack/django), including the WSGI entrypoint and static asset collection. The existing Vercel project now selects Django and builds directly from `pyproject.toml`/`uv.lock`. `vercel.json` sets a 300-second WSGI function limit. Supabase's hosted functions run TypeScript/Deno rather than this Python application. The preview and production deployments have both been verified.

For an existing Django installation, take a database backup before running `migrate`. Migration `0002_daily_scores_user_games` copies collection/rating/placement data into `UserGame`, compacts snapshots into daily values, fixes ranking order/score drift, and then removes the old tables in the migration transaction. It uses historical Django models and is deliberately irreversible: restore the pre-migration backup to recover the original intraday records.

The existing local SQLite database was backed up to `backups/django-before-daily-cleanup-20260928.sqlite3` before its upgrade. The raw Supabase rehearsal export is `backups/supabase-before-daily-cleanup-20260928.json`. Both are private, ignored by Git, and excluded from Docker builds. The source export contains all 9,085 raw snapshots and the rows omitted from the consolidated database.

## Difficulty schema upgrade

The approved [difficulty design](difficulty-rating-plan.md) is deployed. Migration `0003_difficulty_rankings` adds independent difficulty placement fields, labels all existing daily rows as enjoyment, and includes `metric` in history uniqueness/indexing. Existing enjoyment/history values are preserved, and no difficulty votes are seeded. Migration `0004_retire_bgg_difficulty` removes `Game.bgg_weight` and `bgg_num_weights` after all runtime consumers switch to community difficulty.

Retain the full raw source export/database backup before this upgrade; it contains the retired BGG metadata. The importer explicitly discards these two known source fields while still rejecting unexpected fields. Legacy history and baseline imports write only enjoyment series and preserve any difficulty state. Do not reverse these migrations after users vote without preserving their new difficulty data; a structural reverse cannot restore discarded BGG values from the database itself.

The local database was backed up to `backups/django-before-difficulty-20260929.sqlite3` before upgrade. Populated migration tests cover the full `0001` → `0004` path and compare every existing user–game/history field. Production has applied all four hub migrations in its isolated Supabase schema.

## Export and import

The importer accepts a JSON object mapping the 16 expected source table names to arrays; optional derived `user_alignments` can also be present. It rejects missing tables, unknown fields, duplicate association keys, invalid relationships, and ambiguous same-timestamp historical scores. A failed import rolls back the entire transaction.

The audit verified that `game_rules`, `rules_answer_cache`, and `rules_agent_runs` do not exist in the linked Supabase public schema. Explicit flags allow these three verified absences. They only handle the API's missing-table response; authentication/server failures still abort, and existing tables are always exported normally. No core table can be omitted this way.

```sh
mkdir -p backups
# Keys are loaded from the environment / .env / .env.local. Never commit them.
# Only GET requests are made to the legacy REST API.
uv run manage.py import_supabase --from-supabase \
  --export backups/supabase.json --export-only \
  --allow-missing-table game_rules \
  --allow-missing-table rules_answer_cache \
  --allow-missing-table rules_agent_runs

# Only after DATABASE_URL uses the isolated Django schema/role described above:
uv run manage.py migrate
uv run manage.py import_supabase --file backups/supabase.json         # Dry run; rolls back
uv run manage.py import_supabase --file backups/supabase.json --apply # Commit
```

Exports are created with mode 0600 and never overwrite a prior snapshot. `--export-only` does not open the Django database. Pagination continues until each table is exhausted, even when the server returns fewer than 1,000 rows per request. Multiple REST reads are not a database-wide snapshot: freeze legacy writes for the final cutover export. The service-role key is unnecessary in the deployed Django application.

Unchanged source models retain their primary keys and timestamps. Merged user–game rows retain original IDs in `legacy_ids` and separate collection/rating/ranking timestamps. Completely empty collection associations are omitted; their original rows remain in the raw export. Explicit ratings and comments remain independent of normalized tier scores.

The import groups raw history by player/game/local date and keeps the last recorded score, including decreases and null/unranked values. Daily rows have new IDs; original event IDs and timestamps remain in the raw export. No past community averages or difficulty votes are invented. A current-day baseline uses the imported, normalized current rankings; past observed days remain unchanged.

Tied tier positions are resolved by ascending game ID (expansion UUID within an expansion list), then positions are made contiguous within each tier. Scores use the canonical legacy-compatible 10-to-1 formula. The command reports score corrections and position changes. Corrections affect current state and today's daily value, not older history.

Import is a migration/rehearsal tool, not synchronization. Re-importing the same snapshot is idempotent, but an old snapshot can overwrite newer data. Use a fresh/isolated target and stop application writes during the final import.

## Verified rehearsal

The September 28 source export and isolated PostgreSQL result were checked field by field and against an independent daily grouping:

| Check | Result |
| --- | ---: |
| Profiles / catalog games retained | 27 / 234 |
| Current game rankings / explicit ratings retained | 1,006 / 48 |
| Three association tables combined | 1,575 source rows → 1,143 `UserGame` rows |
| Empty collection associations omitted | 28; nine had no other user–game state |
| Raw history compacted | 9,085 events → 5,180 historical daily values |
| New current-day baseline | 1,185 player/community values |
| Total daily rows after rehearsal | 6,365 |
| Current scores / positions corrected | 91 / 9 |
| Curated expansions / expansion placements retained | 26 / 20 |

Ownership, wishlist metadata, every explicit rating/comment, source IDs, collection timestamps, each historical daily closing value, canonical current scores, and current community averages were verified. Missing community observations remain unknown. These are rehearsal results, not evidence of production cutover.

## Cutover

The initial cutover below was completed on September 29, 2026. Interactive Google sign-in still needs a person's browser; the deployed PKCE authorization redirects were checked through Google. Legacy table retirement remains deferred through the rollback window.

1. Configure Vercel for Django and the existing Supabase project's private Django schema/role, connection pooling, HTTPS, secret, allowed hosts, and integrations. Verify a preview against isolated data before production cutover. Back up the database and verify the effective schema/permissions before applying migrations.
2. Rehearse the current export/import on that target and verify counts and representative records, including an imported admin, households, comments, daily decreases, and unknown legacy gaps.
3. Add the Django `/callback?state=<random-state>` URL to Supabase's redirect allowlist for the exact production origin. Retain the existing Google provider configuration. Test a real Google sign-in; imported users keep UUIDs but need fresh browser sessions and have no imported usable password.
4. Test BGG search and an actual chat/rules/PDF request with the configured credentials. Automated tests mock those external boundaries.
5. Freeze writes on the old app, take a fresh raw export, import it into the target, and verify again. The rehearsal export is not a substitute for this final export.
6. Switch traffic to Django. Verify autosave, a lower daily score, unranking, two players editing, a new community average, and a page reload. Confirm there is one row per series/day and every player counts once.
7. Keep the old deployment and database/export available during the rollback window. Once Django accepts writes, rollback must account for those newer writes; the importer is one-way.
8. Retire legacy application tables and derived caches after the rollback window. Keep Supabase Auth intact. The old Next.js app requires its old table contracts, so the source tables cannot be replaced while it is still serving users.

## Deployment record: September 29, 2026

Production deployment: `dpl_9wvd5Ft4aZLjmNLq2QPAGPGqAs7q`, serving https://bart.monster. The prior deployment is `dpl_BSi4DpdojRgf9xhHpLhUDgxJHsUx`. Domain promotion changed the served deployment without changing DNS or the existing Google provider configuration.

- Preview runs against its own private schema. Nineteen authenticated routes, deployed keyboard/drag autosaves and reloads, mobile pages, score decreases, independent difficulty saves, daily uniqueness, BGG search, real Anthropic chat, and a synthetic PDF conversion passed. Synthetic test accounts and their sessions were removed.
- A normal row-by-row remote import was rolled back because network round trips made it slow. The final method imports into disposable local PostgreSQL 17 using the existing importer, validates it, then uses binary `COPY` to transfer all 16 hub tables into an empty destination in one transaction. Deferred foreign keys are checked on commit, and identity sequences are reset. Whole-row hashes for every table matched afterward. This transfer is exclusively an initial empty-target migration, not a synchronization or future release mechanism.
- Legacy `anon`, `authenticated`, and `service_role` DML/TRUNCATE grants and the heartbeat RPC's execute grants were revoked before export. Reads remain available. All source tables were captured in one SQL snapshot, with full floating-point precision, into `backups/deployment-20260929/legacy-final.json` (mode 0600). SHA-256: `c73574fdeb8aea42872fafe225458fb75a3a154796b8b3d4eff05516ecbbc211`.
- Production retains 27 players, 234 games, 1,143 user–game rows, 1,006 enjoyment rankings, 48 explicit ratings, 26 curated expansions, and 20 expansion rankings. All 9,085 original score events remain in the backup; the application stores 5,180 historical daily values plus 1,185 current baseline values. No difficulty votes were invented.
- Private backups also contain the former hosting/auth settings, original grants and a permission-restoration script, migration credentials, verification hashes, and cutover state. Keep these outside Git and deployment uploads. Legacy public tables remain intact and read-only through the API during the rollback window. Django writes exclusively to its new schema.
- Production was built with `--skip-domain`, verified before promotion, and checked again on the public domain. Existing players must sign in again; legacy browser sessions do not become Django sessions. The authorization redirect was verified, but no person's Google account was used to complete an interactive login.

For subsequent releases, back up Django production data, apply any migrations using its dedicated role through the session pooler, and validate a preview. Use `bunx vercel@latest deploy --yes` for preview, `bunx vercel@latest deploy --prod --skip-domain --yes` for a staged production build, and `bunx vercel@latest promote <deployment-url> --yes` after checks. Never re-run the initial importer over newer production writes.

Rollback now requires preserving/reconciling Django writes before restoring legacy write permissions and promoting the old deployment. Restoring only the old deployment would strand new rankings in the Django schema. Retire the old public application tables only after the rollback window; retain Supabase Auth and the raw backups.

## References

- [Project setup and behavior](../README.md)
- [Measurements and checks](refactor-results.md)
- [Live Supabase audit](supabase-audit.md)
- [Django data migration operations](https://docs.djangoproject.com/en/5.2/ref/migration-operations/)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
