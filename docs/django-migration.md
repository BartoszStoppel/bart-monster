# Rust deployment and retained data

This filename is retained for existing documentation links. The active application is Rust/Axum with a React/Vite frontend; Python/Django is a rollback implementation at commit `9a1596e`. The original Next.js application remains at `091d2461f1bf47a6b3b78af7d62275050f33bb20`.

The Rust release retains current Supabase data in place. Production uses the existing private `bart_django` schema/role and previews use `bart_django_preview`. Their historical names are deliberately unchanged: renaming them would add deployment risk without changing application behavior. Supabase Auth and its Google provider remain in the same project. The application is live at https://bart.monster.

## Schema and connection rules

Use the dedicated application role, with its search path set to the private application schema. Do not run application migrations against legacy `public`, `auth`, or `storage`. Browser `anon`/`authenticated` roles must not have access to the private application tables; the browser talks to authorized Rust endpoints instead.

Use the existing Supabase **transaction-pooler URL on port 6543** with `sslmode=require` for runtime requests. Each warm instance permits one client connection and closes it after five idle seconds. Take the host and role-qualified username from the existing verified connection configuration; do not guess them from a region. Use the corresponding session-pooler URL on port 5432 for explicit release migrations.

SQLx 0.8 sends preparation and binding in separate protocol exchanges. Disabling cached/named statements alone still allowed backend reassignment on port 6543 and caused binary parameter/UTF-8 errors during concurrent checks. Every standalone operation now executes through `crate::db::pool(&pool)`, which starts a transaction, fully collects results, commits, then returns them. Existing explicit transactions use their own connection directly. This pins preparation and binding to one backend and prevents callers from seeing a successful result before deferred constraints or commit have succeeded. Session pooling was also tested: 50 concurrent serverless requests exhausted this project's 15-client session-pool ceiling, so it is unsuitable for runtime fan-out. The released transaction adapter passed 100 hosted reads at 50-way concurrency without failures or retries; ordinary local PostgreSQL checks alone do not prove hosted pool behavior.

Before release SQL, verify `current_user`, `current_schema()`, `current_setting('search_path')`, and the expected private-schema grants. Credentials belong in environment variables or private ignored files, never source or shell output.

The explicit Rust migration command is:

```sh
# DATABASE_URL must already select the intended private schema/role through the session pooler.
cargo run --locked --bin bart-monster -- migrate
```

`rust/src/migrate.rs` takes a transaction-scoped migration lock. If `hub_user` does not exist it applies `0001_application.sql`, the empty-install baseline. It then applies idempotent `0005_rust_sessions.sql`, which adds `hub_rustsession` and `hub_chatlease`. Existing application rows are not copied, re-imported, or rewritten. The server and Vercel function do not migrate during requests or normal startup.

The baseline is not an upgrade script to replay over a populated database. Framework-era bookkeeping tables can remain during rollback retention; deleting them is a separate cleanup. `supabase/migrations/` contains historical legacy SQL and must not be applied to the private schema.

## Authentication transition

Rust retains existing user UUIDs, profile data, active flags, staff permissions, and partner links. Google sign-in uses Supabase PKCE with a server-held verifier, a short-lived single-use state, and a session rotation after the callback. Editable provider metadata can name a new ordinary account but cannot grant administrative rights.

Opaque cookies use HttpOnly, SameSite=Lax, and Secure outside localhost. PostgreSQL stores hashed session keys; authenticated sessions have a 14-day absolute lifetime. Every mutation checks `X-CSRF-Token` against the session and the exact configured Origin. Existing Django browser cookies are not Rust sessions, so users sign in again.

Set `APP_ORIGIN=https://bart.monster` in production. For a preview, use its exact origin or omit the value so `VERCEL_URL` supplies the deployment origin. Do not trust a client-supplied Host header. Supabase's redirect allowlist must include the chosen origin's `/callback` path while retaining the existing Google provider configuration. Automated tests use a local fake provider; a real interactive Google sign-in requires a person's browser.

## Vercel release sequence

[Vercel supports Rust functions and Axum directly](https://vercel.com/docs/functions/runtimes/rust). The project uses `vercel_runtime` 2.x rather than the archived community runtime. `api/index.rs` wraps the shared router with the Vercel Axum adapter. `vercel.json` builds the Vite frontend with Bun, serves static assets, routes API/auth/image requests into Rust, and falls back to `index.html` for page navigation.

1. Back up the current private application schema and retain the existing deployment/configuration. The old legacy export is not a backup of newer private-schema writes.
2. Build and test Rust and the frontend. Prepare an isolated preview schema from current data without altering production. Apply the additive Rust release migration there.
3. Configure preview database credentials and exact auth origin; deploy with `bunx vercel@latest deploy --yes`.
4. Verify authenticated pages, permissions, CSRF, game/expansion autosaves, duplicate retries, conflicts, daily decreases, difficulty isolation, static assets, and browser navigation. Mock AI/provider checks remain distinct from any explicitly authorized real integration checks.
5. Apply the additive migration to production through its dedicated role/session-pooler connection after backup. No legacy import or data migration is needed for this language change.
6. Stage production with `bunx vercel@latest deploy --prod --skip-domain --yes`. Check health, assets, API behavior, and effective runtime before changing traffic.
7. Promote the verified URL with `bunx vercel@latest promote <deployment-url> --yes`; recheck https://bart.monster. Keep the previous deployment and backups through the rollback window.

The function limit is 300 seconds. Chat bounds its whole lookup chain at 240 seconds, uses per-request provider timeouts, and coordinates per-user duplicate requests through an expiring PostgreSQL lease. PDF conversion also bounds all provider attempts together at 240 seconds. Provider keys remain server-side. Vercel's ingress body-size limit applies independently of the application's PDF parser limit.

## Completed Rust release

On September 29, 2026, deployment `dpl_2LT4h1yaH6MV5iqP3hGzFu6Rqj6T` was promoted to https://bart.monster after the concurrent API checks and 38 desktop/mobile route checks passed. Its immutable URL is https://bart-monster-ep9fn0kzl-barts-projects-af89ee9c.vercel.app. Runtime source is recorded at commit `617ccfd`.

The live domain returned Rust health, authenticated session/catalog/ranking/history responses, SPA deep links, anonymous API rejection, missing-CSRF rejection, and a valid Supabase Google PKCE initiation. The `www` hostname redirects to the canonical origin with HTTP 308 while retaining path and query. Existing browser sessions require a fresh sign-in. The preceding Django deployment `dpl_9wvd5Ft4aZLjmNLq2QPAGPGqAs7q` and private backups remain available for rollback.

## Data semantics retained by Rust

`hub_usergame` consolidates ownership, wishlist metadata, explicit rating/comment, enjoyment tier/position/score, and independent difficulty tier/position. Removing one kind of state preserves the rest. Completely empty associations can be pruned, while source IDs and original timestamps remain for reconciliation.

`hub_dailyscore` separates enjoyment and difficulty through `metric`. It stores at most one personal value per player/game/local day and one community average per game/local day. Each player's latest score counts once; today's values update immediately, including decreases. Older days remain fixed. No nightly task or intraday log is needed. Quiet days carry known scores forward in charts, while unknown imported observations and null/unranked values remain gaps.

Daily dates use `America/Indiana/Indianapolis`. History has no automatic expiry or global cap. Catalog deletion removes that game's associated data/history. The restored administration UI manages player roles and does not expose account deletion. Any future account-deletion feature must remove personal state safely and refresh today's surviving community means without rewriting older community rows. Backups remain the recovery path for deliberate deletion.

Difficulty is fixed 1–6 and begins with real votes. No BGG complexity fallback or invented historical difficulty values are introduced. The separate BGG enjoyment rating and catalog metadata remain available. Read the [difficulty design](difficulty-rating-plan.md).

## Historical September 29 consolidation

The earlier Django cutover created the private schema and consolidated the original public tables. This record documents that completed historical transformation, not a Rust import to repeat.

| Historical verified transformation | Result |
| --- | ---: |
| Profiles / catalog games retained | 27 / 234 |
| Current enjoyment rankings / explicit ratings retained | 1,006 / 48 |
| Collection + rating + placement associations | 1,575 source rows → 1,143 consolidated rows |
| Empty source collection associations omitted | 28 |
| Raw history events → historical daily values | 9,085 → 5,180 |
| Truthful current-day baseline values | 1,185 |
| Total daily rows after that import | 6,365 |
| Current scores / positions normalized | 91 / 9 |
| Curated expansions / expansion placements retained | 26 / 20 |

Ownership, wishlist metadata, ratings/comments, source IDs/timestamps, daily closing values, current canonical rankings, and community means were reconciled. All raw events remain in the private export. Missing historical community observations were not reconstructed from today's scores.

The final frozen source export was `backups/deployment-20260929/legacy-final.json` with SHA-256 `c73574fdeb8aea42872fafe225458fb75a3a154796b8b3d4eff05516ecbbc211`. It was imported into disposable local PostgreSQL, reconciled, then transferred into an empty production target with whole-row hash comparison. Historical production deployment `dpl_9wvd5Ft4aZLjmNLq2QPAGPGqAs7q` served Django after that cutover. These source counts are historical and are not asserted to be today's production totals.

Legacy API write grants and the old heartbeat RPC's execute grants were frozen before export. The original public tables, original grants, raw export, old deployments, and private configuration backups remain rollback material. They are excluded from Git and deployment uploads. The current app never writes the original public application tables.

## Rollback

A Rust-to-Django rollback can reuse the shared private application data contract, but preserve a fresh backup and review any newer schema changes first. Rust sessions do not authenticate against the old framework, so users may need another login. Leave the additive Rust operational tables in place during rollback; dropping data is unnecessary.

A rollback all the way to the original Next.js app is different: it expects the old public tables. Restoring that deployment alone would strand newer rankings in the private schema. Reconcile those writes before restoring old permissions or traffic. Never replay the September export over live private-schema data, and never drop legacy tables until rollback retention is explicitly complete.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [audit](supabase-audit.md), [verification](refactor-results.md).
