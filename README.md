# bart.monster

A board-game home for a group of friends. Rust/Axum handles authentication, catalog changes, rankings, daily history, BGG requests, and the rules assistant. React/Vite renders the collection, tier lists, community, picker, statistics, achievements, administration, and Furtch stories.

The application is live at **https://bart.monster** on Vercel's native Rust runtime. The existing Supabase project remains the PostgreSQL host and Google sign-in provider. The private production schema is still named `bart_django`; that historical name preserves deployed data and does not require Python or Django.

The frontend restores the Table Monsters dungeon design from GitHub commit `9d2a3fb`, including its navigation, stone/amber palette, card layout, icons and motion, through small compatibility adapters. EB Garamond headings, Hanken Grotesk body text and Geist stats use the original self-hosted font files. The recovered specification and mockup are in [design/](design/README.md). The Python/Django runtime has been removed; its rollback source remains at commit `9a1596e`.

## Local development

Install Rust/Cargo, Bun, and PostgreSQL. Copy `.env.example` to `.env` and set `DATABASE_URL` to a disposable local database. PostgreSQL is required; there is no SQLite fallback or local password-login bypass.

```sh
bun install --cwd web --frozen-lockfile
bun run --cwd web build
cargo run --bin bart-monster -- migrate
cargo run --bin bart-monster
```

Open http://localhost:8000. Rust serves the built frontend. Configure the existing Supabase URL/anonymous key and allow `http://localhost:8000/callback` in Supabase for local Google login. New identities receive ordinary player accounts; staff permissions never come from editable provider metadata.

For Vite hot reload, run the backend with `PORT=8080 APP_ORIGIN=http://localhost:5173` and run `bun run --cwd web dev` in another terminal. Vite proxies API requests to port 8080. The built-frontend workflow above is the simplest way to test the entire callback flow.

Environment values take precedence over `.env`, followed by `.env.local`. `APP_ORIGIN` must be an exact HTTPS origin outside local development; on Vercel it can fall back to the trusted `VERCEL_URL`. Rust stores opaque session keys as hashes in PostgreSQL, uses HttpOnly/SameSite cookies, and binds `X-CSRF-Token` to the session and exact request origin. Changing runtimes requires signing in again.

Optional integrations are `BGG_API_TOKEN`, `ANTHROPIC_API_KEY`, and `CHAT_MODEL` (default `claude-sonnet-4-6`). Missing BGG or AI configuration does not remove existing collection data. Chat sends relevant collection data and selected rulebooks to Anthropic. Database credentials and server API keys stay out of the browser.

## Rankings and history

Enjoyment scores run from 10 to 1 across a player's ordered tier list, separately for board and party games. The server computes scores; moving one game can rescale other games. Every completed game or expansion move autosaves. Requests are serialized, temporary failures retry, identical retries make no additional writes, and conflicting revisions cannot overwrite another tab. There is no manual Save button.

Difficulty is independent: **1 Cuddly, 2 Tame, 3 Challenging, 4 Demanding, 5 Brutal, 6 Monstrous**. Order within a difficulty tier is visual only. Ranking a game in one mode makes it available in the other mode's Unranked bank until assessed there. Community difficulty replaces BGG complexity; no votes means **Unrated**, and fewer than three votes is an early estimate. BGG enjoyment ratings remain separate.

Community supports Enjoyment/Difficulty and Board/Party filters. Players sort by their existing category-specific enjoyment level, then ranked-game count and stable ID. Difficulty votes do not duplicate progression. Eligible hot takes always receive the red glow; there is no checkbox.

For each metric, history stores at most one personal score per player/game/local day and one community average per game/local day. Today's value changes as edits are saved, including decreases. Earlier days remain fixed. Each player's latest score counts once; repeated edits do not increase their weight. **No nightly job is required.** Dates use `America/Indiana/Indianapolis`.

Daily history has no automatic expiry or global row cap. Quiet days carry known values forward in charts without redundant stored observations. Unranking writes a null closing value, and unknown legacy observations remain gaps. History covers game tier scores, not expansion tiers, standalone ratings/comments, or BGG metadata. Catalog deletion removes that game's associated data/history. The restored administration UI manages player roles and does not expose account deletion. Any future account-deletion operation must preserve earlier community history and recompute today's surviving means. Backups protect against deliberate deletion.

Ownership, wishlists, ratings/comments, enjoyment, and difficulty share one `hub_usergame` association while retaining independent fields. Unranking preserves collection state and comments. Connected partner links define households, including one-sided links. The picker uses selected attending players' ratings and collection availability.

## Checks

```sh
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --lib
bun run --cwd web build
bun run --cwd web test
```

PostgreSQL integration tests are explicit and refuse remote database URLs. Use disposable local databases. Ranking and chat tests require the Rust baseline first. Authentication tests create an isolated schema. Action tests create their own schemas and require a separate local database named `bart_actions_test`.

```sh
# DATABASE_URL must point to a disposable local test database.
cargo run --bin bart-monster -- migrate
AUTH_TEST_DATABASE_URL="$DATABASE_URL" cargo test --lib auth::integration_tests -- --ignored
RANKING_TEST_DATABASE_URL="$DATABASE_URL" cargo test --lib ranking_store::tests::postgres -- --ignored
CHAT_TEST_DATABASE_URL="$DATABASE_URL" cargo test --lib chat::integration_tests::postgres -- --ignored
# ACTION_TEST_DATABASE_URL must point to the separate local bart_actions_test database.
cargo test --lib action_tests -- --ignored
```

Coverage includes score decreases, daily rollups, independent metrics, stale/identical saves, PostgreSQL concurrency, authentication/CSRF, BGG parsing, bounded model calls, citations, and rulebook caching. Provider tests use local mocks and make no paid AI requests. See [verification details](docs/refactor-results.md).

The optional browser interaction checks use Playwright against a local Vite server and Rust API with a disposable staff session. Supply a private JSON fixture containing `session` and `user_id`; these release harnesses are separate from the default Bun tests and refuse remote app URLs. They check mouse/touch/keyboard controls, original card effects, animated category changes, fresh-data refresh, focus restoration and autosave navigation protection. The interaction harness loads the otherwise unused rank badge directly through Vite, so use the development server on port 5173.

```sh
uv run --no-project --with playwright python web/tests/browser_interactions.py --fixture /path/to/local-test.json
uv run --no-project --with playwright python web/tests/browser_navigation.py --base-url http://127.0.0.1:5173 --fixture /path/to/local-test.json
uv run --no-project --with playwright python web/tests/browser_theme.py --base-url http://127.0.0.1:8000 --fixture /path/to/local-test.json
```

The deployment regression uses built production chunks and synthetic API responses, with no database or remote requests. It exercises automatic recovery of old tabs, explicit reload, offline fallback, unsaved-navigation guards and reload-loop prevention for Achievements and Furtch.

```sh
bun run --cwd web build
uv run --no-project --with playwright python web/tests/browser_deployment.py
```

The theme harness also supports a deployed base URL and an optional private `--bypass-file`. It checks the actual rendered font families, original branding, card/torch effects, navigation, touch layout and reduced motion, and blocks mutations except the canonical heartbeat.

## Hosting and releases

Keep the current Vercel project and Supabase database. `vercel.json` builds `web/dist` with Bun and routes API/auth requests to `api/index.rs`; static assets and frontend routes stay on Vercel. The native Rust function has a 300-second limit. Chat and PDF conversion each have a 240-second overall provider-work deadline; an expiring database lease prevents duplicate chat requests for one user across instances.

Production requests use the existing private role/schema through Supabase's **transaction pooler on port 6543** with TLS. Each warm instance allows one client connection and closes idle connections after five seconds. SQLx statements disable persistence, and every standalone database operation uses `crate::db::pool(&pool)` to run inside an explicit transaction. This keeps preparation and binding on the same database backend. Existing multi-query transactions remain atomic; results are returned only after commit succeeds. Session pooling exhausted this project's 15-client limit under serverless concurrency, so port 5432 is reserved for explicit release migrations. See [deployment details](docs/django-migration.md) for the protocol and load-test checks.

Migrations run only as an explicit release step. The Rust `migrate` command creates the baseline only for an empty application schema, then adds sessions/chat leases. It does not re-import or overwrite existing rankings.

```sh
bunx vercel@latest deploy --yes
bunx vercel@latest deploy --prod --skip-domain --yes
bunx vercel@latest promote <verified-deployment-url> --yes
```

Back up current data and validate an isolated preview before production promotion. Preserve the previous deployment and old read-only public tables during the rollback window. Never import a legacy export over newer production writes. [Deployment and data preservation](docs/django-migration.md) documents the release sequence; its filename is retained for existing links.

The optional Docker image contains the Rust executable and built frontend, with no Python runtime:

```sh
docker build -t bart-monster .
docker run --rm --env-file .env.production bart-monster migrate
docker run --rm --env-file .env.production -p 8000:8000 bart-monster
```

Set a container-reachable database URL and public `APP_ORIGIN`; terminate HTTPS at the trusted host/proxy. Vercel's request-body limit applies to uploaded PDFs even though the application parser accepts up to 20 MB.

## Source map

- `rust/src/`: Axum routes, authentication, SQL data/actions, ranking calculation/storage, BGG and chat integrations.
- `rust/migrations/`: fresh-install baseline and additive Rust session/lease migration.
- `rust/data/`: preserved assistant tool schemas. Player ranks live in `web/src/lib/ranks.ts`; stories remain in the frontend Furtch page.
- `api/index.rs`: Vercel entrypoint; `rust/src/main.rs`: local/container entrypoint.
- `web/src/`: recovered Table Monsters pages/components, Vite adapters, theme, and autosave UI.
- `design/`: historical design reference; `web/public/fonts/`: self-hosted fonts and licenses.
- `supabase/`: historical SQL and read-only legacy audit; never replay its migrations against the private application schema.
- `archive/`, `emails/`, `scripts/`: preserved historical/personal material, excluded from deployment.

Further documentation: [database audit](docs/supabase-audit.md), [difficulty behavior](docs/difficulty-rating-plan.md), [verification](docs/refactor-results.md), [coding defaults](CLAUDE.md), and [archive](archive/README.md). `ideas.md` remains the user's separate backlog and is not changed during documentation syncs.
