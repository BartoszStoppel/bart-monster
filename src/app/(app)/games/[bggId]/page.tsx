import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import Image from "next/image";
import { EditGameButton } from "./edit-game-button";
import { DeleteGameButton } from "./delete-game-button";
import { CollectionToggles } from "./collection-toggles";
import { BggDetails, SuggestedPlayersTable } from "./bgg-details";
import { ExpansionSection } from "./expansion-section";
import type { CommunityExpansion, CommunityExpansionVote } from "./expansion-community-modal";
import { getHouseholdIds } from "@/lib/household";
import { TIER_COLORS } from "@/lib/tier-colors";
import { getMonsterLevel, levelBadgeClass } from "@/lib/monster-level";
import { StatMeter } from "./stat-meter";
import type { ExpansionTierPlacement, Tier } from "@/types/database";

export const dynamic = "force-dynamic";

interface GameDetailPageProps {
  params: Promise<{ bggId: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  party: "Party Game",
  board: "Board Game",
};



export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { bggId: bggIdParam } = await params;
  const bggId = parseInt(bggIdParam, 10);
  if (isNaN(bggId)) notFound();

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("board_games")
    .select("*")
    .eq("bgg_id", bggId)
    .single();

  if (!game) notFound();

  const admin = await isAdmin(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: owners } = await supabase
    .from("user_game_collection")
    .select("*, profiles(id, display_name)")
    .eq("bgg_id", bggId)
    .eq("owned", true);

  const ownerInfos = (owners ?? [])
    .map((o) => ({
      displayName: (o.profiles as { display_name: string })?.display_name ?? "Unknown",
      userId: o.user_id,
    }))
    .filter((o) => o.displayName !== "Unknown");

  const householdIds = user ? await getHouseholdIds(supabase, user.id) : [];
  const householdSet = new Set(householdIds);
  const currentUserOwns = ownerInfos.some((o) => householdSet.has(o.userId));

  const { data: wishlisters } = await supabase
    .from("user_game_collection")
    .select("*, profiles(id, display_name)")
    .eq("bgg_id", bggId)
    .eq("wishlist", true);

  const wishlisterInfos = (wishlisters ?? [])
    .map((w) => ({
      displayName: (w.profiles as { display_name: string })?.display_name ?? "Unknown",
      userId: w.user_id,
    }))
    .filter((w) => w.displayName !== "Unknown");

  const { data: tierPlacements } = await supabase
    .from("tier_placements")
    .select("tier, score, user_id, profiles(display_name)")
    .eq("bgg_id", bggId)
    .order("score", { ascending: false });

  const rankings = (tierPlacements ?? [])
    .map((tp) => {
      const profile = Array.isArray(tp.profiles) ? tp.profiles[0] : tp.profiles;
      return {
        displayName: (profile as { display_name: string } | null)?.display_name ?? "Unknown",
        tier: tp.tier,
        score: tp.score ? Number(tp.score) : null,
      };
    })
    .filter((r) => r.displayName !== "Unknown");

  const currentUserWishlisted = wishlisterInfos.some((w) => householdSet.has(w.userId));

  // Renown — glory of conquering a rare beast. Inverse of the monster-level
  // idea: the FEWER members have ranked (tier-placed) this game, the harder it
  // is to conquer and the greater its renown. Measured as the share of the
  // whole roster that has NOT yet ranked it.
  const { count: totalMembers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  const conqueredBy = rankings.length;
  // Renown VALUE (the formula/score) is inverse — high when few have conquered it.
  const renownPct =
    totalMembers && totalMembers > 0
      ? (1 - conqueredBy / totalMembers) * 100
      : null;
  // The meter BAR shows the un-inverted conquest share (how much of the roster
  // has ranked it) so it reads as a normal progress-to-conquered fill.
  const conqueredPct =
    totalMembers && totalMembers > 0
      ? (conqueredBy / totalMembers) * 100
      : 0;

  // Expansion tier list: admin-curated word bank, the user's own placements,
  // and the community aggregate shown in the breakdown popup.
  const { data: bank } = await supabase
    .from("game_expansions")
    .select("*")
    .eq("game_bgg_id", bggId)
    .order("created_at", { ascending: true });
  const expansionBank = bank ?? [];

  const { data: myPlacementsData } = user
    ? await supabase
        .from("expansion_tier_placements")
        .select("*")
        .eq("game_bgg_id", bggId)
        .eq("user_id", user.id)
    : { data: [] };
  const myExpansionPlacements = (myPlacementsData ?? []) as ExpansionTierPlacement[];

  const { data: allExpansionPlacements } = await supabase
    .from("expansion_tier_placements")
    .select("expansion_id, tier, score, user_id, profiles(display_name)")
    .eq("game_bgg_id", bggId);

  const communityMap = new Map<
    string,
    { votes: CommunityExpansionVote[]; total: number; scored: number }
  >();
  for (const p of allExpansionPlacements ?? []) {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const displayName =
      (profile as { display_name: string } | null)?.display_name ?? "Unknown";
    if (displayName === "Unknown") continue;
    const entry =
      communityMap.get(p.expansion_id) ?? { votes: [], total: 0, scored: 0 };
    const score = p.score != null ? Number(p.score) : null;
    entry.votes.push({ displayName, tier: p.tier as Tier, score });
    if (score != null) {
      entry.total += score;
      entry.scored += 1;
    }
    communityMap.set(p.expansion_id, entry);
  }

  const communityExpansions: CommunityExpansion[] = expansionBank
    .map((b) => {
      const entry = communityMap.get(b.id);
      const avgScore =
        entry && entry.scored > 0
          ? Math.round((entry.total / entry.scored) * 10) / 10
          : null;
      return {
        id: b.id,
        name: b.name,
        thumbnailUrl: b.thumbnail_url,
        avgScore,
        voteCount: entry?.votes.length ?? 0,
        votes: entry?.votes ?? [],
      };
    })
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

  const playerRange =
    game.min_players && game.max_players
      ? game.min_players === game.max_players
        ? `${game.min_players}`
        : `${game.min_players}-${game.max_players}`
      : null;

  const scoredRankings = rankings.filter((r) => r.score != null);
  const oursAvg = scoredRankings.length
    ? scoredRankings.reduce((a, r) => a + (r.score as number), 0) / scoredRankings.length
    : null;
  const heroImage = game.image_url || game.thumbnail_url;

  // Monster level (1–10): blends our rating, BGG, complexity, time, age, players.
  const level = getMonsterLevel(oursAvg, game);
  const subtitle = game.categories?.length
    ? game.categories.slice(0, 3).join(" · ")
    : game.category
      ? CATEGORY_LABELS[game.category] ?? game.category
      : null;
  const weight = game.bgg_weight != null ? Number(game.bgg_weight) : null;
  const complexityPct = weight != null ? Math.min(weight / 5, 1) * 100 : 0;
  const timePct = game.playing_time ? Math.min(game.playing_time / 180, 1) * 100 : 0;
  const timeLabel =
    game.min_play_time && game.max_play_time && game.min_play_time !== game.max_play_time
      ? `${game.min_play_time}-${game.max_play_time}m`
      : game.playing_time
        ? `${game.playing_time}m`
        : "—";

  return (
    <div className="relative z-10 flex flex-col gap-margin">
        {/* Encounter view — two-column (design/code-detail.html) */}
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
          {/* Left: the encounter card + actions */}
          <div className="flex flex-col gap-stack-compact md:col-span-5">
            <article className="encounter-card hero-reveal flex flex-col rounded-lg">
              {/* Header band — threat level */}
              <div className="flex items-center justify-end border-b border-outline-variant bg-surface-container-high px-4 py-2">
                {level != null && (
                  <span
                    title="Threat level (1–10) from our rating, BGG, complexity, time, age & player count"
                    className={`rounded border bg-surface-container-highest px-2 py-0.5 font-stat text-stat-label ${levelBadgeClass(level)}`}
                  >
                    LVL {level}
                  </span>
                )}
              </div>

              {/* Artwork */}
              <div className="relative h-72 overflow-hidden bg-black sm:h-80">
                {heroImage ? (
                  <Image
                    src={heroImage}
                    alt={game.name}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 520px"
                    className="object-cover opacity-80 mix-blend-luminosity transition-all duration-700 hover:opacity-100 hover:mix-blend-normal"
                    style={{ viewTransitionName: `game-art-${game.bgg_id}` }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-outline-variant">No image</div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent" />
              </div>

              {/* Stat area */}
              <div className="flex flex-grow flex-col justify-between gap-4 p-card-padding">
                <div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="font-display text-display-lg leading-none text-primary">{game.name}</h1>
                    {game.year_published && (
                      <span className="font-stat text-stat-label text-on-surface-variant">{game.year_published}</span>
                    )}
                  </div>
                  {subtitle && (
                    <p className="font-body text-caption uppercase tracking-wider text-on-surface-variant">{subtitle}</p>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 items-end gap-x-4 gap-y-3">
                  {oursAvg != null && (
                    <StatMeter icon="local_fire_department" label="Power" value={`${oursAvg.toFixed(1)}/10`} pct={(oursAvg / 10) * 100} tone="amber" hint="Power — our group's average rating, out of 10." />
                  )}
                  {renownPct != null && (
                    <StatMeter icon="auto_awesome" label="Renown" value={`${(renownPct / 10).toFixed(1)}/10`} pct={conqueredPct} tone="green" hint={`Renown — the glory of conquering a rare beast. Only ${conqueredBy} of ${totalMembers} ${totalMembers === 1 ? "challenger has" : "challengers have"} ranked it; the fewer, the greater the renown.`} />
                  )}
                  {weight != null && (
                    <StatMeter icon="swords" label="Ferocity" value={`${weight.toFixed(2)}/5`} pct={complexityPct} tone="amber" hint="Ferocity — how complex the game is to learn and play (BGG weight, out of 5)." />
                  )}
                  {game.playing_time != null && (
                    <StatMeter icon="hourglass_empty" label="Stamina" value={timeLabel} pct={timePct} tone="green" hint="Stamina — typical play time, in minutes." />
                  )}
                  {playerRange && (
                    <StatMeter icon="groups" label="Charm" value={playerRange} pct={(Math.min(game.max_players ?? game.min_players ?? 0, 8) / 8) * 100} tone="amber" hint="Charm — the player counts this game supports." />
                  )}
                  {game.min_age != null && (
                    <StatMeter icon="calendar_today" label="Maturity" value={`${game.min_age}+`} pct={(Math.min(game.min_age, 18) / 18) * 100} tone="green" hint="Maturity — minimum recommended player age." />
                  )}
                </div>
              </div>
            </article>

            {/* Action row — owned/wishlist (stacked checkboxes) + admin controls */}
            {(admin || user) && (
              <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-card-padding">
                {user && (
                  <div className="flex flex-col items-start">
                    <CollectionToggles
                      bggId={bggId}
                      currentUserId={user.id}
                      initialOwned={currentUserOwns}
                      initialOwners={ownerInfos}
                      initialWishlisted={currentUserWishlisted}
                      initialWishlisters={wishlisterInfos}
                    />
                  </div>
                )}
                {admin && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant pt-3">
                    <EditGameButton game={game} />
                    <DeleteGameButton bggId={game.bgg_id} gameName={game.name} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: scroll panels */}
          <div className="stagger flex flex-col gap-margin md:col-span-7">
            {game.description && (
              <section className="bevel-border relative overflow-hidden rounded-lg bg-surface-container-highest p-card-padding">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-container opacity-5 blur-3xl" />
                <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 font-display text-headline-lg text-primary">
                  <span className="material-symbols-outlined">menu_book</span> Ancient Scrolls
                </h2>
                <div className="space-y-4 whitespace-pre-line font-body text-body-md text-on-surface-variant">
                  {game.description.slice(0, 1200)}
                  {game.description.length > 1200 ? "…" : ""}
                </div>
              </section>
            )}

            {rankings.length > 0 && (
              <section className="bevel-border rounded-lg bg-surface-container p-card-padding">
                <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 font-display text-headline-lg text-secondary-container">
                  <span className="material-symbols-outlined">social_leaderboard</span> The Verdict
                  <span className="ml-auto font-stat text-stat-label text-on-surface-variant">
                    {rankings.length} {rankings.length === 1 ? "ruling" : "rulings"}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {rankings.map((r) => (
                    <div
                      key={r.displayName}
                      className="bevel-border flex items-center gap-2 rounded bg-surface-dim px-3 py-2"
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white ${TIER_COLORS[r.tier] ?? "bg-surface-container-highest"}`}
                      >
                        {r.tier}
                      </span>
                      <span className="font-body text-sm text-on-surface">{r.displayName}</span>
                      {r.score != null && (
                        <span className="font-stat text-xs text-on-surface-variant">{r.score.toFixed(1)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {game.mechanics?.length > 0 && (
              <section className="bevel-border rounded-lg bg-surface-container p-card-padding">
                <h2 className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-2 font-display text-headline-lg text-primary">
                  <span className="material-symbols-outlined">strategy</span> Battle Plan
                </h2>
                <div className="flex flex-wrap gap-2">
                  {game.mechanics.map((m: string) => (
                    <span
                      key={m}
                      className="rounded-full border border-outline-variant bg-surface-dim px-3 py-1 font-body text-caption text-on-surface"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Full-width detail sections (wide interactive content) */}
        <div className="stagger flex flex-col gap-stack-loose">
          <ExpansionSection
            gameBggId={bggId}
            gameName={game.name}
            isAdmin={admin}
            bggExpansions={game.expansions ?? []}
            bank={expansionBank}
            myPlacements={myExpansionPlacements}
            community={communityExpansions}
          />

          {game.suggested_players?.length > 0 && <SuggestedPlayersTable data={game.suggested_players} />}

          <BggDetails game={game} />
        </div>
      </div>
  );
}
