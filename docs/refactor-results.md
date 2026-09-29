# Rust rewrite and verification

The current runtime is Rust/Axum with SQLx and a React/Vite frontend. Supabase remains the database/Google identity provider; Vercel's official native Rust runtime hosts the application at the existing bart.monster project. The private `bart_django` schema name is retained to preserve current data without another import.

Original Next.js source: `091d2461f1bf47a6b3b78af7d62275050f33bb20`. Django rollback source: `9a1596e`. The Python runtime directories, package manifest/lockfile, management entrypoint, and Django deployment configuration are superseded by Cargo, explicit SQL migrations, and Bun/Vite.

## Scope

- Rust owns authorization, CSRF, Supabase PKCE, opaque database sessions, mutations, scoring/revisions, daily history, BGG/image access, and the assistant.
- The frontend reuses the original dashboard page/component structure and navigation through compatibility adapters. It restores a brown palette while retaining autosave, difficulty controls, and the always-visible hot-take glow.
- No original brown screenshot/exact palette was recovered. Layout/source reuse and the restored theme do not establish a pixel-for-pixel color match.
- The user–game consolidation, independent enjoyment/difficulty state, daily rollups, decreases, and retained historical data remain intact. Rust does not re-import a legacy snapshot over newer writes.
- Source stories, rank definitions, archived assets, personal scripts, and historical Supabase SQL remain preserved. `ideas.md` is excluded from documentation edits.

## Size claims

The former Django line/byte totals described that implementation only. They are not measurements of this Rust/React edition and have been removed from current comparison claims. Reusing original UI code plus server-side validation and regression tests changes the comparison scope. No 50% reduction or performance gain is claimed without a current reproducible measurement/benchmark. Build artifacts, vendored dependencies, lockfiles, private backups, and archive material must be excluded consistently from any future source-size comparison.

## Automated verification

An earlier release verification completed 39 Rust unit and explicitly invoked local PostgreSQL checks, with formatting and Clippy passing. Subsequent concurrent Supabase checks found that nonpersistent query wrappers alone did not make SQLx 0.8 transaction pooling safe: preparation and binding could reach different backends. Session pooling avoided that protocol problem but exhausted this project's 15-client ceiling under 50 concurrent serverless requests. Runtime now uses port 6543 with `db::pool` enclosing every standalone operation in an explicit transaction; existing multi-query transactions remain intact. The final release must verify this adapter with concurrent hosted reads rather than treating ordinary PostgreSQL tests as pooler proof. Applying the additive Rust migration to production preserved the contents of all 23 pre-existing tables in a whole-table hash comparison. This verifies data preservation, not a completed domain promotion.

Rust unit tests cover canonical enjoyment normalization/rounding, fixed difficulty values, revision scoping, stale and identical retries, unranking/decreases, expansion isolation, BGG parsing, and data validation. Frontend tests/build checks cover the adapted request and presentation logic.

The auth PostgreSQL test uses a local mock Supabase provider and verifies PKCE state, single-use callback, session rotation, exact-Origin/session-token CSRF, metadata privilege rejection, existing profile/staff preservation, inactive accounts, expiration, and logout. It creates an isolated schema and refuses remote database URLs.

Ranking PostgreSQL tests exercise row locks and concurrent saves, independent personal fields, daily personal/community means, nullable unranking, category/expansion scope, and write-free identical retries. Action tests exercise API authentication, permissions, validation and mutation behavior against local disposable databases. The pool-adapter regression verifies an explicit transaction for standalone operations, committed writes, rollback after statement errors, deferred-FK commit failures without leaked results, and 128 parameterized queries from 32 concurrent tasks.

Chat provider tests use a local HTTP mock. They verify one request for a final answer, tool-result continuation, pause-turn handling, bounded retries/rounds, valid citation deduplication, conversation limits, Reddit URL restrictions, and legacy-compatible rulebook hashes. The PostgreSQL chat test verifies the three-vote enjoyment threshold, fixed community difficulty, comparisons, cached rulebook answers, and audit persistence without any paid request.

Explicit local integration test commands are documented in [README.md](../README.md). Ignored database tests are not automatically counted as passing by the default unit command. PostgreSQL baseline/session SQL is exercised without importing Django.

## Browser and deployment checks

`web/tests/browser_smoke.py` and `browser_autosave.py` are release harnesses tied to private local fixtures. They are not part of the portable default test command. The Bun domain tests and Rust tests are the repeatable source-controlled checks; browser release results are recorded separately below.

Check the collection, tier lists, community, profiles, wishlist, picker, statistics, achievements, feedback, Furtch, chat, and admin pages at desktop/mobile sizes. Exercise authenticated reloads, navigation, actual drag/drop, independent metric saves, same-day decreases, CSRF errors, retries, revision conflicts, and visible error states. A successful screenshot alone does not verify saving or database consistency.

Production release verification must separately identify the deployed Rust runtime, confirm health/static/API responses, and validate the shared Supabase schema and authorization redirects. Completing real Google sign-in is an interactive browser check. Live BGG/AI/PDF calls are separate from automated mocked-provider tests; do not report historical Django integration checks as Rust checks.

The multi-stage Docker build uses Bun for frontend assets and Cargo for the Rust binary, running as UID 10001. A fresh build with the transaction-pool adapter is awaiting its final smoke check; the earlier image predates that fix and is not the final artifact. Verification must cover a fresh disposable PostgreSQL migration, Rust health response, SPA deep-link HTTP 200, database session bootstrap, and anonymous protected-API rejection, plus absence of Python, environment files and backups. Migrations remain an explicit release step.

## Historical data evidence

The September 29 consolidation retained 27 players, 234 games, 1,006 enjoyment placements, 48 explicit ratings, 26 curated expansions, and 20 expansion placements at that cutover. It merged 1,575 source association rows into 1,143 user–game rows and compacted 9,085 raw history events into 5,180 historical daily values plus 1,185 truthful current-day baseline values. These are historical verified counts, not current production totals.

The raw export, earlier deployments and frozen legacy tables remain rollback evidence. The Rust release adds sessions and cross-instance chat leases while retaining current application tables. Read [the deployment guide](django-migration.md) and [the original database audit](supabase-audit.md) before cleanup or rollback.
