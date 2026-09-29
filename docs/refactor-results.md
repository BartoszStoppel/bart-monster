# Refactor and database cleanup results

Baseline: Git commit `091d2461f1bf47a6b3b78af7d62275050f33bb20`. Django, the database cleanup, and difficulty rankings are live on Vercel as of September 29, 2026. Supabase remains the production database/sign-in provider; the final import and production cutover are verified.

| Text source | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Lines | 17,512 | 9,441 | 46.1% |
| Bytes | 598,527 | 361,874 | 39.5% |
| Files | 121 | 59 | |

Before counts tracked `.ts`, `.tsx`, and `.css` under `src/`. After counts `.py`, `.html`, `.js`, `.css`, and `.json` under `hub/` and `config/`, plus `manage.py`. The after total includes regression/browser tests, data migrations, preserved story/rank data, and chat schemas. Both exclude binary assets, dependencies, lockfiles, build output, personal scripts, documentation, and the archived site. Source is formatted, not minified to meet a target. The original refactor reached 52.3% fewer lines before the approved difficulty feature. These current totals include that added functionality, migrations, and tests; no minification was used to retain the earlier reduction percentage.

## Implemented behavior

- Game and expansion tier edits autosave after every completed drag or Move action. Requests are serialized, temporary failures retry, identical replays are idempotent, and stale conflicting edits cannot overwrite another tab. The board stays in place and receives server-owned scores.
- For each metric, history now stores at most one value per player/game/day and one community value per game/day. Each player's latest tier score counts once in the community average. Today's value changes as edits are saved; older days remain fixed. There is no nightly job or intraday event table. Quiet days carry known values forward without extra stored rows.
- The chart defaults to community history and supports player selection, signed decreases, unranked gaps, and unknown legacy periods. Imported daily rows carry provenance so missing old observations are not mistaken for unchanged values.
- `UserGame` replaces separate collection, explicit rating, and tier-placement tables. The fields remain independent, including notes, comments, and original source IDs/timestamps. Fully empty associations are pruned; inactive notes/priority survive. All related mutations lock the user to preserve concurrent edits to different fields.
- Alignments are computed rather than stored. Expansion placements derive their parent game. Redundant leading-column indexes are removed where composite unique indexes cover the lookup.
- Activity, achievements/awards, bounties, curated expansions, rulebooks, answer cache, and run logs remain separate because their lifecycles differ.
- Hot takes keep the always-visible red glow, with no checkbox or display preference. Selection uses the greatest absolute score deviation among games with three non-null rankings and breaks ties by lowest BGG ID.

- Difficulty adds independent fixed 1–6 tiers from Cuddly to Monstrous on the same `UserGame` rows. A placement in either mode is available in the other mode's Unranked bank until assessed, without resetting existing placements or fabricating votes/history.
- Community filters by Enjoyment/Difficulty and category, and orders players by existing level descending, then progression count and stable user ID. Difficulty scores do not double-count player progression.
- Community difficulty replaces BGG difficulty across game pages, collection sorting, statistics, picker weighting, and chat. Unknown difficulty stays Unrated. The legacy BGG difficulty fields are retired; their original values remain in the raw backup.

## Follow-up site review

The full-site review fixes malformed collection options that hid Board games and household ownership filters, picker tier/weight calculations using absent players, inconsistent one-sided household links, double-counted household Shelf of Shame games, inactive accounts displacing visible taste matches, and stale community history after admin account deletion. Both single and bulk account deletion now recalculate today's enjoyment/difficulty means under the ranking locks; older community days remain fixed.

Identical ranking saves now acknowledge without database writes. Game/expansion score recalculation shares one implementation; imports reuse the community daily-score writer instead of maintaining another aggregate path. Metric validation no longer builds display configuration during sorting, and community queries avoid an unused user join. Rules cache keys treat equivalent expansion selections identically. Long chat requests discard older whole exchanges to remain within the server limit without removing visible messages.

Compared with the pre-review working tree, runtime source adds 40 lines overall: correctness handling exceeds the removed duplication. Added regression/browser coverage accounts for the other 227 lines. The review does not claim a net line reduction or remove validation to meet a size target.

## Deduplication pass

The next pass removes **117 runtime lines** and adds 51 lines of regression coverage: **66 fewer total lines** than the preceding review, with the same number of source files and no added dependencies or schema migrations.

- Collection, statistics, and chat use the same enjoyment/difficulty aggregate query. Display thresholds stay explicit: three enjoyment votes, one difficulty vote. Correlated aggregates protect counts and averages from unrelated joins.
- Collection flags, wishlists, acquisition, and explicit ratings share one transaction/save/cleanup path while preserving their independent fields and timestamps.
- Ranking and admin mutations share ordered batch row locking. The transaction boundaries and single-user locks remain intact.
- Statistics reads chart values directly instead of building community taste matches, hot takes, and player presentation. Household awards load user–game associations once and accumulate household sets directly.
- `hub/chat_tools.py` replaces repeated JSON schemas with shared parameter/schema builders, also used by rules tools. All seven generated collection-tool payloads were compared with the original JSON and matched exactly, including descriptions, requirements, enums, and cache control.

New regressions compare collection/statistics/chat results, check low-vote and unrated cases, exercise joined aggregate queries, and guard against unnecessary taste calculations on statistics pages.

## Real-data rehearsal

The original export was also rehearsed through difficulty migrations `0003`/`0004` on September 29, with the same verified counts below and no seeded difficulty votes. The explicitly requested Supabase audit/export was separate from automated tests. A complete raw export was retained privately before compaction, including all 9,085 source history events. It was imported into isolated PostgreSQL 17, not production.

| Transformation | Verified result |
| --- | --- |
| Collections + ratings + placements | 1,575 source rows → 1,143 user–game associations |
| Empty collection associations | 28 omitted; nine otherwise-empty pairs removed |
| Raw historical events | 9,085 → 5,180 historical daily values |
| Current baseline | 1,185 new daily values; 6,365 daily rows total |
| Ranking normalization | 91 current scores corrected; nine positions normalized |
| Preserved data | 27 users, 234 games, 1,006 rankings, 48 ratings, all comments/active collection metadata, 26 curated expansions, 20 expansion placements |

Every active collection association, rating/comment, source ID, collection timestamp, and historical daily closing value was compared with the source export. Current scores were compared with the canonical ordering/formula; current community values were independently averaged. Forced-index query plans confirmed that expansion, rulebook, and cache game lookups use their composite unique indexes. This validates index coverage, not a claimed latency improvement.

The import handles the three confirmed-absent rules tables through explicit flags, with errors still aborting. Raw exports use mode 0600, never overwrite an existing file, and are excluded from Git and Docker. The existing local Django database also has a pre-upgrade backup. See [the migration guide](django-migration.md) for commands, exact counts, rollback, and cutover steps.

## Verification

- PostgreSQL 17: all **84 backend tests pass**, including same-user revision conflicts, different-player daily community consistency, and concurrent ownership/ranking writes to one association.
- SQLite: 78 backend tests pass, including the populated old-schema-to-new-schema data migration; the six PostgreSQL row-lock checks are skipped.
- All **ten browser checks pass**: real dragging without reloads, rapid queued moves updating one daily score, retries before/after a committed save, conflicts, expansion/keyboard autosaves, the JavaScript-free fallback, difficulty mode switching, difficulty retries, mobile charts, restored collection dropdowns, and long-chat requests.
- A final populated-page pass checked all 18 main/admin routes at mobile width: no JavaScript errors or horizontal page overflow. Desktop collection and mobile game pages were also visually reviewed.
- Review regressions also cover symmetric/connected household membership, deduplicated household awards, attending-player picker filters, inactive taste matches, write-free identical saves, cache selection equivalence, and concurrent account deletion/voting.
- Daily-history tests cover local date boundaries, decreases across days, one row per series/day including nullable community users, equal player weighting despite frequent edits, unranking, unknown imported gaps, duplicate display names, categories, and more than 2,000 daily points without truncation.
- Consolidation tests verify independent ownership/rating/tier fields, preservation on unranking, empty-row pruning, inactive notes/priority, rating counts, strict missing-table handling, pagination below the configured page size, import rollback/idempotency, and migration of populated legacy Django tables.
- Difficulty tests also cover independent revisions, fixed scores, cross-mode Unranked banks, level ordering, metric filters, sitewide aggregates, unknown-value behavior, picker weights, chat validation, retired-source import handling, and category changes. Populated migration tests preserve all prior user–game/history fields through `0004`.
- Existing tests continue to cover authentication/CSRF/admin boundaries, category/deletion recalculation, picker modes, community/hot-take calculations, households, metadata, PKCE, BGG parsing, and mocked AI/tool behavior.
- Ruff lint/format and migration consistency checks pass. The existing local Django database upgraded successfully after its backup. The live export was rehearsed without modifying Supabase application data.
- The current Docker image builds, passes production Django checks, includes the cleanup migration, and excludes credentials, SQLite files, and backups.

Earlier refactor verification also covered Docker/Gunicorn/WhiteNoise startup, production Django settings, dark mobile layouts, charts, picker, and main/admin pages. Actual Google provider configuration, real BGG calls, and paid Anthropic chat/PDF requests remain outside automated tests.

## Production status

The production site is https://bart.monster, deployment `dpl_9wvd5Ft4aZLjmNLq2QPAGPGqAs7q`. Separate private Supabase roles/schemas isolate production and preview. All 16 imported application tables matched the verified local import field for field; the final counts match the rehearsal above. A frozen, atomic raw export and the old deployment are retained. Legacy API writes are frozen, and old public tables remain during the rollback window.

The deployed preview passed 19 authenticated route checks, keyboard/drag autosaves with reloads, daily decreases and difficulty isolation, mobile layouts, BGG search, real AI chat, and PDF conversion. Production health, authenticated pages, static assets, and Google authorization redirects were checked after promotion. Interactive Google sign-in was not completed on anyone's behalf. See the [deployment record](django-migration.md#deployment-record-september-29-2026) for pooling, backups, release commands, and rollback constraints.

The [audit report](supabase-audit.md) preserves the original live findings and now records implementation status. Project documentation is synchronized with daily retention, the consolidated model, and the [approved difficulty feature](difficulty-rating-plan.md). `ideas.md`, archived source/assets, story/email content, and historical Supabase migration files remain unchanged.
