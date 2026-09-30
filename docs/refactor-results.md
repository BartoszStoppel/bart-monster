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

Concurrent Supabase checks found that nonpersistent query wrappers alone did not make SQLx 0.8 transaction pooling safe: preparation and binding could reach different backends. Session pooling avoided that protocol problem but exhausted this project's 15-client ceiling under 50 concurrent serverless requests. Runtime now uses port 6543 with `db::pool` enclosing every standalone operation in an explicit transaction; existing multi-query transactions remain intact. The final adapter passed the hosted concurrency checks recorded below. Applying the additive Rust migration to production preserved the contents of all 23 pre-existing tables in a whole-table hash comparison.

Rust unit tests cover canonical enjoyment normalization/rounding, fixed difficulty values, revision scoping, stale and identical retries, unranking/decreases, expansion isolation, BGG parsing, and data validation. Frontend tests/build checks cover the adapted request and presentation logic.

The auth PostgreSQL test uses a local mock Supabase provider and verifies PKCE state, single-use callback, session rotation, exact-Origin/session-token CSRF, metadata privilege rejection, existing profile/staff preservation, inactive accounts, expiration, and logout. It creates an isolated schema and refuses remote database URLs.

Ranking PostgreSQL tests exercise row locks and concurrent saves, independent personal fields, daily personal/community means, nullable unranking, category/expansion scope, and write-free identical retries. Action tests exercise API authentication, permissions, validation and mutation behavior against local disposable databases. The pool-adapter regression verifies an explicit transaction for standalone operations, committed writes, rollback after statement errors, deferred-FK commit failures without leaked results, and 128 parameterized queries from 32 concurrent tasks.

Chat provider tests use a local HTTP mock. They verify one request for a final answer, tool-result continuation, pause-turn handling, bounded retries/rounds, valid citation deduplication, conversation limits, Reddit URL restrictions, and legacy-compatible rulebook hashes. The PostgreSQL chat test verifies the three-vote enjoyment threshold, fixed community difficulty, comparisons, cached rulebook answers, and audit persistence without any paid request.

Explicit local integration test commands are documented in [README.md](../README.md). Ignored database tests are not automatically counted as passing by the default unit command. PostgreSQL baseline/session SQL is exercised without importing Django.

## Browser and deployment checks

The final Rust test set has 43 checks: 30 default unit/mock checks and 13 explicitly invoked local PostgreSQL checks. Formatting, strict Clippy, the frontend production build, and seven Bun tests passed. The deployed transaction-pool implementation passed 100 authenticated reads at 50-way concurrency with no retries or failures (p95 0.93 seconds, maximum 1.12 seconds), followed by authenticated no-op saves for both ranking metrics. These timings describe that bounded release check, not a general capacity benchmark.

Before promotion, full-row comparisons confirmed the catalog, user–game associations, all 6,365 daily history rows, expansions/placements, achievements/awards, bounties, feedback and rulebooks still matched the pre-Rust backup. The browser preview also passed queued saves through a retry, navigation protection, independent difficulty reloads and stale-tab conflict handling; synthetic preview rankings and accounts were removed.

`web/tests/browser_smoke.py` and `browser_autosave.py` are release harnesses tied to private local fixtures. They are not part of the portable default test command. The Bun domain tests and Rust tests are the repeatable source-controlled checks; browser release results are recorded separately below.

The production candidate passed 38 route/viewport browser checks covering the collection, tier lists, community, profiles, wishlist, picker, statistics, achievements, feedback, Furtch, chat, and administration. No JavaScript errors, layout overflow, or unexpected application API failures occurred. All visible cover images decoded: 24 on desktop and 12 on mobile. One initial transport failure did not recur in the complete diagnostic pass. Regicide Legacy's optional 32-pixel tint request still encounters a decoder limit; its cover displays correctly. Immutable-host heartbeat rejections were expected because production CSRF is restricted to the canonical origin.

Deployment `dpl_2LT4h1yaH6MV5iqP3hGzFu6Rqj6T` was promoted on September 29, 2026. The live https://bart.monster domain passed Rust health, authenticated session/catalog/ranking/history, SPA deep-link, authorization and CSRF checks. Supabase Google PKCE initiation passed; completing real Google sign-in remains an interactive browser check. The `www` redirect preserves path and query. Live BGG/AI/PDF calls remain separate from automated mocked-provider tests; historical Django integration checks are not counted as Rust checks.

The final browser smoke on the canonical live domain passed desktop collection/navigation and mobile difficulty rankings/community with no API or JavaScript errors. All three authenticated heartbeats returned HTTP 200. The synthetic production account, its sessions and activity were then removed; the removed session returned HTTP 401. A final full-row comparison confirmed the catalog, associations, 6,365 history rows and related content still matched the pre-Rust backup. Disposable local test servers and PostgreSQL were stopped and removed.

The final multi-stage Docker build uses Bun for frontend assets and Cargo for the Rust binary, including the transaction-pool adapter and all updated runtime callers. Verified image `7607fae4605d` is 99,904,759 bytes and runs as UID 10001. Its smoke check passed a fresh disposable PostgreSQL migration, Rust health response, SPA deep-link HTTP 200, database session bootstrap, and anonymous protected-API rejection. Python, environment files and backups were absent from the runtime image. The smoke container/database were removed afterward; migrations remain an explicit release step.

## Interaction follow-up

The follow-up audit compares the restored components with the original source and exercises computed styles and input events. Original card lift, image zoom, button highlights and modal keyframes were present; several surrounding state and input bugs interrupted them or hid controls.

- Same-page query changes and refreshes retain controls so selection highlights can animate. Stale controls are inert during loading, focus returns after loading, and the autosave guard still blocks navigation and refresh while changes are pending. Ranking boards reset when their scope/revision changes, and collection, wishlist and expansion state reconcile fresh data.
- One selection-indicator hook handles horizontal scrolling and resizing across collection, wishlist, picker and category selectors. Tier category controls remain mounted separately from the independently keyed board.
- Cached card colors survive return navigation. Thumbnail sampling avoids decoding full cover images; Regicide Legacy's previously failing tint request now returns HTTP 200.
- Card actions appear on mouse hover, keyboard focus and actual touch devices. Navigation handles hover followed by click, focus changes, Escape and mobile profile-menu placement. Title and rank popovers support keyboard interaction; title popovers toggle on touch.
- Surface defaults use the CSS components layer, allowing login hover background/border utilities to take effect. Monospace text has a valid font fallback and the original font smoothing is restored.
- Chart markers respond through their visible dots and larger hit areas; decorative overlays no longer intercept them. Tooltips support touch and focus, with a first touch preview before following scatter-chart links.
- The picker keeps its ten-second normal spin, avoids restarting when images arrive, disables filters during a spin, and keeps repeated spins moving forward. Failed image loads are bounded. CSS and canvas motion respect reduced-motion preferences without suppressing the selected result.

The local Vite harnesses `web/tests/browser_interactions.py` and `browser_navigation.py` exercise real mouse/touch/keyboard behavior and response-mocked refreshes without mutating their disposable database. Navigation checks cover retained DOM and transitions, keyboard focus, fresh data, autosave protection, metric resets, collection/wishlist reconciliation, expansion changes and preserved profile drafts. These remain explicit release checks, separate from the portable Bun domain tests.

The broader browser pass completed 102 assertions, including 19 routes in each combination of light/dark theme and desktop/touch input, card lift/zoom/control visibility, normal picker result animations and reduced-motion behavior. It reported no JavaScript or API errors and no page overflow. The production frontend build and seven Bun domain tests passed. Rust code and database schema were unchanged by this follow-up.

Targeted checks also passed chart mouse/keyboard/touch interaction, two complete forward spins with delayed image loading, disabled filters while spinning, immediate reduced-motion results and bounded mixed successful/failed image requests. The existing autosave release harness passed again against disposable local PostgreSQL: queued retry ordering, browser Back protection, independent difficulty persistence and stale-tab conflicts. No production ranking writes were used for these checks.

The corrected hosted build `e3dd41c` passed the cross-menu keyboard/hover regression and was promoted as `dpl_FYPtm1yijaH6qKfnu2YQfAMFAmuH`. On https://bart.monster, the bundle matched the verified build and card animations, both cross-menu Escape sequences, touch toggles and mobile menu bounds passed. Canonical heartbeats returned HTTP 200 with no JavaScript/API failures. Authenticated session/catalog/ranking/history, CSRF, anonymous API rejection, Google PKCE initiation and canonical redirects passed. The temporary verification account, activity and sessions were removed; its session then returned HTTP 401. Local disposable test resources were removed. `ideas.md` remained untouched.

## Historical data evidence

The September 29 consolidation retained 27 players, 234 games, 1,006 enjoyment placements, 48 explicit ratings, 26 curated expansions, and 20 expansion placements at that cutover. It merged 1,575 source association rows into 1,143 user–game rows and compacted 9,085 raw history events into 5,180 historical daily values plus 1,185 truthful current-day baseline values. These are historical verified counts, not current production totals.

The raw export, earlier deployments and frozen legacy tables remain rollback evidence. The Rust release adds sessions and cross-instance chat leases while retaining current application tables. Read [the deployment guide](django-migration.md) and [the original database audit](supabase-audit.md) before cleanup or rollback.
