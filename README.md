# bart.monster

A Django home for a board-game group: shared collection, BGG discovery, personal enjoyment/difficulty and expansion tier lists, community scores and taste comparisons, household wishlists, a weighted picker, statistics, achievements, feedback, Furtch stories, and an optional AI rules assistant.

The app uses Django templates and a small vanilla JavaScript file. There is no frontend build step. Django manages application data and sessions; the existing Supabase project remains the production PostgreSQL host and Google sign-in provider. SQLite is convenient locally.

The Django rewrite, difficulty rankings, and database cleanup are live at **https://bart.monster** as of September 29, 2026. Vercel runs Django; Supabase remains the database and Google sign-in provider. Existing players retain their accounts and data but must sign in again for a Django session. See [the results](docs/refactor-results.md), [migration guide](docs/django-migration.md), and [Supabase audit](docs/supabase-audit.md).

## Scores, daily history, and hot takes

Enjoyment tier scores run from 10 to 1 across each player's ordered rankings, separately for board and party games. Adding, removing, or moving one game can change other games' scores too. Every completed drag or **Move** action saves automatically, for both game and expansion tiers. The board stays in place and displays **Saving…** or **Saved**, with scores supplied by the server.

Rapid moves are saved in order. Temporary failures retry automatically; an identical save, including a retry after a lost response, acknowledges the current ranking without another database write. A conflicting edit from another tab stops the queue and shows a reload link. Keep the tab open until **Saved** appears: pending moves are held in memory, and navigation warns while changes remain unsaved. Without JavaScript, each **Move** form saves through a normal page request.

For each metric, history stores **at most one value per game/player/day and one community average per game/day**. Each player counts once in the community average, using their latest tier score. Editing more often does not increase their weight. Today's value updates immediately; the final saved value becomes that day's closing value. Older days stay unchanged. There is **no nightly job** and no need to keep intraday events. Quiet days carry the previous known value forward without redundant database rows.

Statistics and game pages default to community history, with optional player history and signed daily changes. Dates use `America/Indiana/Indianapolis`. Unranking clears today's personal score and recalculates the community average; it does not erase older days. A day ending with no score creates a chart gap. Displayed current collection/statistics averages require three ratings; history retains the average across the available rankings even below that threshold.

The original Supabase export is retained separately for rollback. Import compacts old events into each local day's last recorded value, including decreases. Missing legacy observations are shown as **Unknown** gaps: the old app failed to record most community history, so that period cannot be reconstructed honestly. The application retains daily history indefinitely. It tracks game tier scores, not standalone ratings/comments, expansion rankings, or BGG metadata. Deleting a catalog game removes its history; deleting a user removes their personal history. Use backups to recover deliberately deleted data. Admin account deletion also updates today’s community average for both metrics; earlier community days remain fixed.

Ownership, wishlists, explicit ratings/comments, and tier positions share one `UserGame` association. These remain independent: ranking a game does not mark it owned, and unranking leaves ownership and comments intact. Completely empty associations are removed; notes and priorities are retained even when a game is not currently wishlisted. Households use connected partner links consistently, including one-sided legacy links. Household awards count each game once, and a ranking by either partner removes it from the household’s Shelf of Shame. The picker applies enjoyment tier filters and player-ranked weights only to selected players; games those players have not ranked remain eligible. Source IDs and timestamps are kept for reconciliation. Activity, achievements, bounties, and curated expansions keep their separate lifecycles.

On **Community**, each player's hottest take always has a red glow, with no checkbox or display toggle. It is the ranked game whose score differs most from its community average, considering only games with at least three non-null rankings in the selected category. Both unusually high and unusually low scores qualify. Ties select the lowest BGG ID. The highlight is rendered by Django and works without JavaScript.

## Difficulty rankings

Switch **Enjoyment / Difficulty** on the tier list, Community, profiles, and statistics. Difficulty asks how much effort a game takes to learn and play well. Its fixed levels are **1 Cuddly, 2 Tame, 3 Challenging, 4 Demanding, 5 Brutal, 6 Monstrous**; higher means harder. Order within a difficulty tier is visual only. Every placement autosaves, and a game ranked in one mode appears in the other mode's Unranked bank until assessed there. Existing placements in the other mode stay intact.

Community difficulty averages each player's current vote once. Shared query helpers supply current enjoyment/difficulty means and vote counts; unrelated table joins cannot inflate those counts. It replaces BGG difficulty in game details, collection sorting, charts, the picker's Favor easy / Favor hard modes, and chat filtering/recommendations. Games without votes show **Unrated**; there is no BGG fallback. Averages with fewer than three votes are marked as early estimates. Difficulty-based picker modes exclude unrated candidates and report that count; other picker modes keep them eligible.

Community supports independent metric and Board games / Party games filters. Both player lists sort by existing player level descending, then enjoyment-ranked game count, then stable user ID. Switching metric does not change earned levels. Each mode has its own automatic hot-take glow; enjoyment taste comparisons and predictions appear only in Enjoyment mode.

`UserGame` stores both independent placements without a duplicate table or current difficulty-score cache. `DailyScore.metric` separates personal/community daily history for enjoyment and difficulty. Both follow the daily retention policy above. BGG's unrelated enjoyment rating and catalog metadata remain available. See the [approved design and implementation](docs/difficulty-rating-plan.md) for edge cases and validation.

## Run locally

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```sh
uv sync --frozen
cp .env.example .env
uv run manage.py migrate
uv run manage.py createsuperuser
uv run manage.py runserver
```

Open http://127.0.0.1:8000. Expand **Sign in with a local account** to use the superuser. Set its display name in `/admin/`. A fresh install starts with an empty catalog; add games at `/search`, or import the existing site using [the migration guide](docs/django-migration.md).

Configuration comes from the environment, then `.env`, then the existing `.env.local`; earlier values win. Leave an optional setting out rather than defining it as empty if you want to inherit its legacy value. `DJANGO_DEBUG=true` enables development settings. Production requires an explicit secret and HTTPS.

Optional integrations:

- `BGG_API_TOKEN`: BGG searches and metadata refreshes.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`: existing Google sign-in; legacy `NEXT_PUBLIC_SUPABASE_*` names also work. Allow the Django callback URL in Supabase before testing Google sign-in.
- `ANTHROPIC_API_KEY`: chat and PDF-to-Markdown conversion. `CHAT_MODEL` selects the model; defaults to `claude-sonnet-4-6`.

Rules answers share a cache entry for the same set of expansions regardless of name casing, order, or duplicate selections. Long chats send a bounded recent conversation while keeping earlier messages visible.

Missing integrations do not prevent local sign-in or existing collection features. API errors are shown in the UI. Chat sends collection data and selected rulebooks to Anthropic, as the original app did.

## Verify

```sh
uv run manage.py test
uv run ruff check config hub manage.py
uv run ruff format --check config hub manage.py
uv run manage.py makemigrations --check --dry-run
uv run manage.py collectstatic --noinput
```

Tests cover routes with empty/populated data, auth/CSRF/admin boundaries, transactional tier saves, repeated/stale edits, daily history and unknown legacy gaps, downward score changes, independent user–game fields, consolidation migrations, hot-take eligibility, scoring, expansion isolation, category/deletion recalculation, ownership, wishlists, picker filters, community calculations, import rollback, PKCE callback validation, BGG parsing, and mocked AI/tool behavior. Tests never call paid AI services or the live database. Run the suite against a disposable PostgreSQL database via `DATABASE_URL` to also exercise its row-lock tests; those six tests are skipped on SQLite.

The optional ten-check browser suite covers collection dropdowns, long chats, difficulty mode switching/mobile charts and real dragging, rapid queued moves and daily rollups, retries before and after a committed save, conflicts, expansion/keyboard moves, and the JavaScript-free fallback. It runs against Django's disposable test database and local test server:

```sh
uv run --with playwright python -m playwright install chromium
uv run --with playwright manage.py test hub.browser_checks
```

Set `CHROMIUM_EXECUTABLE` to reuse an existing Chromium binary instead of installing one. Playwright is only needed for these browser checks; it is not an application dependency.

```sh
uv run manage.py fetch_games 13 266192       # Add or refresh specified BGG games
uv run manage.py fetch_games --refresh-all # Refresh existing metadata; keep categories
```

## Deploy

Keep **Supabase for PostgreSQL and Google sign-in**. Supabase's hosted [Edge Functions use TypeScript/Deno](https://supabase.com/docs/guides/functions/quickstart), so the Django process runs on the application host. [Vercel runs Django](https://vercel.com/docs/frameworks/full-stack/django) in the existing project. `vercel.json` selects Django and a 300-second function limit; Vercel collects static files during the build.

Production uses the private `bart_django` schema/role; previews use `bart_django_preview`. Neither is available to Supabase browser API roles. Vercel connects through the transaction pooler on port 6543 with `DATABASE_POOL_MODE=transaction` and `DATABASE_CONN_MAX_AGE=0`; settings disable prepared statements and server-side cursors. Apply migrations separately through the session pooler on port 5432, using the same dedicated role. Vercel deployments require `DATABASE_URL` and cannot fall back to SQLite. Deployment/branch hosts are added from Vercel environment variables. Follow the [migration guide](docs/django-migration.md) for release steps and rollback precautions.

The Docker image remains available for local production rehearsals or a container deployment:

```sh
docker build -t bart-monster .
# Set DATABASE_URL for an isolated Django target, plus secrets/hosts/integrations in .env.production.
# Set DJANGO_DEBUG=false, and configure HTTPS at the reverse proxy.
docker run --rm --env-file .env.production bart-monster python manage.py migrate
docker run --rm --env-file .env.production -p 8000:8000 bart-monster
```

Set `TRUST_PROXY=true` only when a trusted reverse proxy replaces the `X-Forwarded-Proto` header. Set `DJANGO_CSRF_TRUSTED_ORIGINS=https://bart.monster` and the correct `DJANGO_ALLOWED_HOSTS`. Run `manage.py check --deploy` with production configuration. The image collects static assets and serves them through WhiteNoise; migrations are a separate release step. Back up the PostgreSQL database normally. Configure a shared Django cache if deploying multiple instances and you need globally shared BGG caching/chat concurrency limits; the default cache is per process.

## Structure

- `config/`: settings, routes, WSGI entry point.
- `hub/models.py`, `forms.py`, `admin.py`: data, validation, and administration.
- `hub/ranking.py`: shared scoring, transactions, revisions, and taste predictions.
- `hub/insights.py`: daily history summaries and community/hot-take/household/achievement calculations.
- `hub/views.py`: normal Django views and small JSON endpoints.
- `hub/bgg.py`, `auth.py`, `chat.py`: external integrations; `hub/chat_tools.py` shares tool schemas and parameter definitions.
- `hub/templates/`, `hub/static/`: shared HTML, CSS, and progressive enhancement.
- `hub/data/`: preserved stories and rank definitions.
- `supabase/`: historical schema and migration evidence; **do not apply it to Django**. `audits/efficiency.sql` contains read-only diagnostics, outside the migrations directory.
- `archive/`, `emails/`, and the personal email scripts remain as historical/personal material; they are not part of the Django runtime.

Documentation: [migration and cutover](docs/django-migration.md), [measurements and verification](docs/refactor-results.md), [Supabase audit](docs/supabase-audit.md), [coding guidance](CLAUDE.md), and [the archived monster site](archive/README.md). `ideas.md` is the separate ideas backlog and is not rewritten as part of this documentation sync.

This refactor uses full-page forms for most actions, automatic saves for tier edits, and complete chat replies instead of token streaming. Tier moves also work with keyboards and without JavaScript. The admin interface is Django's built-in admin. See [the migration guide](docs/django-migration.md) for data preservation and cutover details.
