# Difficulty tier lists — approved design and implementation

Status: approved, implemented, and deployed September 29, 2026. The live Django app includes the feature and migrations `0003`/`0004`, using Vercel and an isolated schema in the existing Supabase project. The initial import preserves enjoyment data and starts difficulty with no invented votes. See the [deployment record](django-migration.md#deployment-record-september-29-2026).

The approved definition is overall effort to learn and play well, using fixed difficulty values per tier. The implementation includes Cuddly/Tame through Monstrous, Community mode filtering and player-level sorting, availability in the other mode's Unranked bank, and replacement of BGG difficulty throughout the website with community difficulty. Verification is recorded in [the refactor results](refactor-results.md).

## Experience and scoring

Add an **Enjoyment / Difficulty** selector to the personal tier list. Difficulty uses the same game tiles, drag-and-drop, keyboard/Move controls, unranked bank, autosave queue, retry status, and navigation protection. Retain the Board games / Party games categories. Each game can have an enjoyment placement, a difficulty placement, both, or neither.

The two modes share game availability for each player. Ranking a game in one mode automatically makes it available in the other mode's **Unranked** bank if it has no placement there:

| Player's saved state | Enjoyment view | Difficulty view |
| --- | --- | --- |
| Enjoyment only | Keep its enjoyment tier | Show in Unranked |
| Difficulty only | Show in Unranked | Keep its difficulty tier |
| Both | Keep its enjoyment tier | Keep its difficulty tier |
| Neither | Available in the existing catalog's Unranked bank | Available in the existing catalog's Unranked bank |

This applies to existing enjoyment rankings at launch as well as new rankings, regardless of ownership or wishlist state. Preserve the selected Board games / Party games category. Switching modes after an autosave reflects the saved state. Ranking or unranking in one mode never resets an existing placement in the other. Showing a game in Unranked creates no vote, score, or history in that mode. Derive bank membership from the catalog and the player's saved placements; no synchronization job, duplicate association, or stored pending-rating row is needed.

Prompt: “How much effort does this game take to learn and play well?” This is one overall assessment, including rules burden and decision-making. Rate the base game under its normal rules. Expansion-specific difficulty is a later extension.

Use six named tiers, shown hardest first, with **higher = harder** stated beside the board. Tier labels:

| Level | Name | Description |
| ---: | --- | --- |
| 6 | Monstrous | Extremely demanding rules, planning, or interacting systems. |
| 5 | Brutal | Heavy learning effort and sustained concentration. |
| 4 | Demanding | Several systems to manage and substantial planning. |
| 3 | Challenging | Meaningful rules and decisions; some learning effort. |
| 2 | Tame | Straightforward rules with a little planning. |
| 1 | Cuddly | Quick to learn and easy to follow. |
| — | Unranked | No difficulty assessment yet; excluded from averages. |

Difficulty uses fixed levels 1–6, with order inside a tier saved as a visual preference. All Cuddly votes count as 1; all Monstrous votes count as 6. Display the named tier prominently and label numerical summaries as difficulty out of 6. An unranked game has no score, rather than zero.

This differs from the current enjoyment formula, which spreads every player's ranked games across 10–1 regardless of tier names. Reusing that formula unchanged would give a player's only Cuddly game a score of 10 and change its score when unrelated games are added. Fixed difficulty levels avoid that behavior.

Community difficulty is the mean of each player's current level, with equal weight per player. Show the vote count; mark averages based on fewer than three votes as early estimates. Difficulty disagreement highlights use the existing automatic red glow: each player's largest absolute deviation among games with at least three difficulty votes, with the same deterministic tie break. Include text explaining that the highlight concerns difficulty.

This community mean is the website's authoritative difficulty metric. Use it consistently wherever the website currently uses BGG difficulty, including features that use difficulty without displaying its number. Personal difficulty remains visible as the player's assessment. No votes means **Unrated**, with no BGG fallback or assumed middle score.

## Data design

Keep the existing `UserGame` association and add:

- `difficulty_tier`: nullable integer 1–6; null means unranked.
- `difficulty_position`: nonnegative order within that tier, default 0.
- `difficulty_updated_at`: timestamp of the last difficulty placement change, nullable initially.

The tier value is also the personal difficulty score, so no duplicate current `difficulty_score` column is needed. Keep one row per user/game. Validate the range and require position 0 when unranked. Update `prune_empty()` so a difficulty-only association survives collection, review, or enjoyment changes. Difficulty mutations update only their own fields; clearing difficulty preserves all other user–game state.

Extend `DailyScore` with a constrained `metric` value: `enjoyment` or `difficulty`. Existing rows default to enjoyment without recalculating historical values. Include the metric in both partial unique constraints:

- Personal: metric + user + game + local day.
- Community: metric + game + local day, for rows whose user is null.

Adjust the history lookup index to metric + game + day. Audit every history reader/writer and legacy import query to select a metric explicitly, including the importer's current-day baseline. Shared storage must never mix the two series or overwrite the other metric's daily row. No duplicate game catalog, placement table, or history table is needed.

Share one query/aggregation definition for current community difficulty and vote count across displays, sorting, picker logic, and chat. Aggregate the non-null difficulty placements once per user/game and avoid duplicating votes through joins to other relations. Derive the current mean rather than storing another cached score on `Game`.

## Shared implementation

Use a small, explicit configuration for the two board modes: tier choices, descriptions, order, score scale, help text, and URLs. Adapt `hub/templates/hub/board.html`, which currently hard-codes S/A/B/C/D/F, and its Move options and accessibility labels. Reuse the autosave JavaScript rather than copying it.

Keep ranking operations in `hub/ranking.py`. Share request validation, ordered placements, revisions, retries, and transaction handling while using the appropriate fields/scoring for each mode. The existing enjoyment formula and expansion rankings retain their behavior.

Add explicit difficulty save/Move endpoints. Preserve existing enjoyment URLs. Use `metric=difficulty` for page selectors, preserving metric and category through history filters, redirects, profile links, and reload links. Reject unknown modes and invalid tiers server-side.

Scope revisions to the user, category, and metric. Concurrent enjoyment and difficulty edits should not invalidate each other's revisions or overwrite fields. Concurrent edits to the same difficulty board retain stale-edit rejection and identical-retry acknowledgement. Lock user and game rows in a consistent order and commit the placement and daily aggregates together; reuse the established concurrency protections.

Reordering within a difficulty tier updates position/revision but adds no score history. Reclassification between board/party categories preserves the difficulty assessment and normalizes positions where necessary. Refreshing BGG data cannot overwrite local difficulty votes. Catalog/user deletion follows the current documented cascade behavior. Admin user deletion also recalculates today’s community mean for each metric, including a null value after the last vote disappears; older community values remain unchanged.

## Where the results appear

- **Personal tier list:** the two modes, full tier descriptions, automatic saves, and independent unranked banks.
- **Game page:** your difficulty tier, community difficulty and vote count, other players' assessments, and a link to place the game. Replace the BGG complexity badge with community difficulty out of 6.
- **Collection:** replace Complexity sorting with community Difficulty sorting, putting unrated games last. Preserve old `sort=weight` links as aliases for the new sort.
- **Community:** an explicit Enjoyment / Difficulty filter, with players ordered by their existing player level, highest first. Apply the chosen mode to placements, counts, averages, labels, and automatic hot takes. See the detailed behavior below.
- **Profiles:** selectable enjoyment and difficulty placements. Keep rank progression and achievements tied to their existing inputs.
- **Statistics:** selectable enjoyment/difficulty summaries and daily history. Replace the BGG complexity axis and table column with community difficulty, including when viewing enjoyment scores against difficulty. Difficulty charts use a 1–6 scale and named levels; numerical tables accompany the charts. Parameterize chart bounds, binning, tooltips, and descriptions that currently assume BGG's 1–5 scale or enjoyment's 1–10 scale. A decrease means the game is now considered easier; describe movement without implying that a higher number is better.
- **Game picker:** switch existing Favor easy / Favor hard modes to community difficulty as part of this feature.
- **Chat:** use community difficulty in game details, recommendations, range filters, and sorting, with clear scale and vote-count information in tool results.

Do not seed users' difficulty votes from BGG or enjoyment scores. BGG's enjoyment rating and unrelated catalog metadata remain separate features. Expansion-specific difficulty and new picker controls beyond replacing the current difficulty input can follow later.

## Replacing BGG difficulty throughout the website

The source audit identified these required changes:

| Current use | Files | Replacement |
| --- | --- | --- |
| Complexity badge | `hub/templates/hub/game.html` | Community difficulty, scale, and vote count; Unrated when missing |
| Collection sort | `hub/views.py`, `hub/templates/hub/collection.html` | Community difficulty; nulls last and deterministic ties |
| Statistics data, scatter axis, table, and tooltips | `hub/views.py`, `hub/templates/hub/statistics.html`, `hub/static/hub/app.js` | Community difficulty on a 1–6 scale |
| Favor easy / Favor hard picker probabilities | `hub/views.py`, `hub/templates/hub/picker.html` | Weight rated candidates using community difficulty |
| Chat filters, ordering, result fields, and tool descriptions | `hub/chat.py`, `hub/chat_tools.py` | Explicit community difficulty fields and 1–6 range parameters |
| Imported BGG difficulty and its vote count | `hub/bgg.py`, `hub/models.py`, `hub/management/commands/import_supabase.py` | Retire these inputs after all consumers move; retain original values in backups |

Games with no difficulty votes show **Unrated**. Numeric difficulty filters and scatter plots exclude those unknown values, with the UI making the missing data clear; ordinary catalog views still show the games. Sorting places unknown difficulty last in either direction.

For the existing difficulty-weighted picker modes, the rule is to consider only games with community difficulty votes, show how many otherwise-eligible games lack votes, and explain an empty result if none are rated. Random and enjoyment-based picker modes continue to include eligible unrated games. For rated games, use `7 - difficulty` as the easy-mode weight and `difficulty` as the hard-mode weight before applying the existing weighting-strength control; both stay positive on the 1–6 scale. Do not treat missing difficulty as easy, zero, or a BGG score.

Rename chat's BGG-specific `min_weight` / `max_weight` and difficulty sort/result fields to explicit community-difficulty equivalents. Validate the 1–6 range and provide the mean, vote count, scale, and source in tool results. A request using the old BGG scale must not be silently reinterpreted. Recommendations can state that difficulty is unknown instead of inventing a value.

After all runtime consumers have moved, remove the obsolete `bgg_weight` and `bgg_num_weights` fields through a follow-up migration and stop refreshing them from BGG. First retain the original values in the raw backup and update the legacy importer to explicitly accept/omit these two known retired fields while continuing to reject other unmapped fields. Do not edit historical migrations or the still-running legacy Supabase schema. Test the complete import through the latest migrations. Generic probability weights used by the picker and similarity calculations are unrelated to BGG difficulty and remain in place.

## Community filtering and player order

Place an **Enjoyment / Difficulty** selector alongside **Board games / Party games** on Community. The filters are independent: changing one preserves the other. Use URLs such as `/community?metric=difficulty&category=board` so refreshes, browser navigation, and shared links retain the selected view. Enjoyment is the default for existing links.

In Difficulty mode, show difficulty placements, named tiers, difficulty ranking counts, community difficulty averages, and difficulty hot takes. Display enjoyment taste comparisons and predicted favorites only in Enjoyment mode; these algorithms do not measure difficulty agreement. A player with no difficulty placements gets a clear empty state, not an enjoyment fallback.

Replace alphabetical player order with this deterministic order in both the summary table and everyone's expandable rankings:

1. Existing **player level**, highest first, using the numeric rank-ladder threshold rather than sorting rank names.
2. Number of enjoyment-ranked games contributing to that level, highest first, to order players within the same level.
3. Stable user ID for exact ties, avoiding alphabetical ordering and unstable reshuffles.

Use the existing Community level calculation: enjoyment-ranked games in the selected Board games / Party games category. Changing the metric filter does not change a player's earned level or their place in this ordering. Difficulty rankings do not add duplicate progression credit. The displayed placement count follows the selected metric and is separate from the count used for level progression. Difficulty levels 1–6 describe games; player levels describe participation in the existing rank ladder.

Keep all currently eligible active players visible, including those with no placements in the selected mode. Compute the sort from the already loaded/aggregated data without a database query per player. Return consistently sorted `users` and `rows` from the Community data layer, and preserve similarity-based ordering within taste-comparison lists.

## History and retention

Apply the existing daily retention policy independently to difficulty: at most one personal value per user/game/day and one community average per game/day. Same-day changes replace today's value. Prior days remain fixed, known values carry through quiet days, and no nightly job or intraday event table is required.

Unranking writes a null personal value for today and recomputes the community mean from remaining votes. No remaining votes means a null community value. Today's aggregate updates even if only one player has voted; low-vote presentation does not suppress the underlying daily history. Difficulty history begins with real votes after feature launch; there is no invented backfill. Retain daily history indefinitely under the existing deletion/backup policy.

## Implementation sequence and validation

1. Use the approved definition, fixed 1–6 scoring, and six labels documented above.
2. Add a new migration after `0002`: difficulty fields, constraints, and the history metric/keys/index. Leave the existing migrations intact. Rehearse against a copy of populated Django data and verify that enjoyment values and history are unchanged.
3. Extend the ranking service and shared board, including automatic availability in the other mode's Unranked bank and preservation of existing placements. Verify the difficulty workflow end to end before adding its reporting views.
4. Add game, collection, community, profile, and statistics presentation, including Community's independent metric/category filters and descending player-level order. Replace the BGG difficulty input in picker and chat as well. Audit importer, admin, category changes, and all history queries for metric isolation.
5. Verify there are no runtime BGG difficulty consumers, adapt legacy import handling, and retire its unused columns after retaining a backup. Run backend tests on SQLite and PostgreSQL, focused browser checks, lint/format checks, and migration consistency checks. Update the implementation/setup/migration documentation, leaving `ideas.md` unchanged.
6. Rehearse the complete feature with preview data. Keep Supabase as the database/sign-in provider and follow the existing Django deployment/cutover process; this feature does not change hosting providers.

Acceptance checks covered by the implementation tests:

- One Cuddly game remains level 1 when unrelated games are added or removed; within-tier order does not alter scores.
- Enjoyment and difficulty can disagree for the same game and survive edits to collection flags, reviews, wishlists, and the other ranking mode.
- Existing and newly ranked enjoyment games appear in Difficulty's Unranked bank until given a difficulty placement, and the reverse works for difficulty-only games. Games ranked in both retain both placements. Identical saves perform no database writes or duplicate tiles, and appearing in the other bank adds no vote or history there.
- Two users saving difficulty concurrently produce the correct community mean; simultaneous different-mode edits preserve both sets of fields.
- Rapid moves, temporary failures, lost responses, stale tabs, keyboard moves, mobile layout, and the no-JavaScript fallback behave consistently with the existing board.
- Same-day edits produce one daily value per metric/series, decreases across local dates remain visible, quiet days carry correctly, and removing the last vote creates an unranked gap.
- Game/user lists, charts, tooltips, history filters, and legacy import baselines cannot mix enjoyment and difficulty or mistake absent votes for zero.
- Community preserves metric and category when either filter changes, after refresh/back navigation, and through shared links. Difficulty mode never presents enjoyment rankings or recommendations as difficulty data.
- Community lists a higher-level player before a lower-level player regardless of their names. Same-level ties follow progression count, then stable user ID; the table and expandable rankings agree. Switching Enjoyment/Difficulty preserves player levels and ordering within the same category, including players with no difficulty votes.
- A community difficulty change affects the game badge, collection sort, statistics, picker, and chat consistently. Tests use conflicting legacy BGG values to prove that no feature falls back to or blends them with community votes.
- No-vote games remain Unrated, sort last, and follow the documented filtering/picker rules. Removing the final difficulty vote restores this state across every consumer. Scale labels, axes, chat range validation, and tool descriptions all use 1–6.
- Source snapshots containing the retired BGG difficulty fields still import successfully after the cleanup migration; unrelated unknown source fields still fail validation, and the original raw backup remains intact.
- Existing enjoyment, expansion, ownership, recommendation, and history tests continue to pass, including migration of populated data and preservation of all old history rows.

Before applying or reversing the migration on a populated target, retain a backup. Reversing it after difficulty votes exist would discard those new fields/history; preserving that data is part of rollback planning. Production has applied these migrations after preview verification. Preserve new difficulty votes/history before any rollback; the legacy app cannot represent them.
