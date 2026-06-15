import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import Image from "next/image";
import { EditGameButton } from "./edit-game-button";
import { DeleteGameButton } from "./delete-game-button";
import { CollectionToggles } from "./collection-toggles";
import { BggDetails, SuggestedPlayersTable } from "./bgg-details";
import { ExpansionSection } from "./expansion-section";
import { TorchGlow } from "./torch-glow";
import type { CommunityExpansion, CommunityExpansionVote } from "./expansion-community-modal";
import { getHouseholdIds } from "@/lib/household";
import { TIER_COLORS } from "@/lib/tier-colors";
import { getRarity } from "@/lib/rarity";
import type { ExpansionTierPlacement, Tier } from "@/types/database";

export const dynamic = "force-dynamic";

interface GameDetailPageProps {
  params: Promise<{ bggId: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  party: "Party Game",
  board: "Board Game",
};

/**
 * BoardGameGeek mark as a monochrome inline SVG (path from Simple Icons) so it
 * inherits `currentColor` and themes like the Material Symbol stat icons,
 * instead of the colour-clashing raster logo.
 */
function BggMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="m19.7 4.44-2.38.64L19.65 0 4.53 5.56l.83 6.67-1.4 1.34L8.12 24l8.85-3.26 3.07-7.22-1.32-1.27.98-7.81Z" />
    </svg>
  );
}

/**
 * A single labelled stat meter (matches the Complexity/Time bars from
 * design/code-detail.html): icon + label on the left, value on the right, a
 * recessed track + proportional fill below. `tone` picks amber vs slime-green.
 */
function StatMeter({
  icon,
  bggIcon,
  label,
  value,
  pct,
  tone = "amber",
}: {
  icon?: string;
  bggIcon?: boolean;
  label: string;
  value: string;
  pct: number;
  tone?: "amber" | "green" | "brown";
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillClass = tone === "green" ? "time" : tone === "brown" ? "brown" : "";
  const valueClass =
    tone === "green" ? "text-secondary-container" : tone === "brown" ? "text-on-surface-variant" : "text-primary";
  return (
    <div className="flex h-full flex-col justify-end gap-1">
      <div className="flex items-end justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate whitespace-nowrap font-stat text-stat-label text-on-surface-variant">
          {bggIcon ? (
            <BggMark className="h-[14px] w-[14px] shrink-0" />
          ) : (
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          )}{" "}
          {label}
        </span>
        <span className={`shrink-0 whitespace-nowrap font-stat text-stat-label ${valueClass}`}>
          {value}
        </span>
      </div>
      <div className="stat-bar-track h-3 w-full">
        <div className={`stat-bar-fill ${fillClass}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

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
  const rarity = getRarity(oursAvg, game.bgg_rating != null ? Number(game.bgg_rating) : null);
  const heroImage = game.image_url || game.thumbnail_url;

  // Encounter-card derived values (design/code-detail.html mapping)
  const level =
    oursAvg != null
      ? Math.round(oursAvg)
      : game.bgg_rating != null
        ? Math.round(Number(game.bgg_rating))
        : null;
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
    <>
      <TorchGlow />
      <div className="relative z-10 flex flex-col gap-margin">
        {/* Encounter view — two-column (design/code-detail.html) */}
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
          {/* Left: the encounter card + actions */}
          <div className="flex flex-col gap-stack-compact md:col-span-5">
            <article className="encounter-card hero-reveal flex flex-col rounded-lg">
              {/* Rarity header */}
              <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-4 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-[18px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                  <span className="font-stat text-stat-label uppercase tracking-widest text-primary">
                    {rarity ? `${rarity} Encounter` : "Unknown Relic"}
                  </span>
                </div>
                {level != null && (
                  <span className="font-stat text-stat-label text-on-surface-variant">LVL {level}</span>
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
                    <StatMeter icon="local_fire_department" label="Our Rating" value={`${oursAvg.toFixed(1)}/10`} pct={(oursAvg / 10) * 100} tone="brown" />
                  )}
                  {game.bgg_rating != null && (
                    <StatMeter bggIcon label="BGG" value={`${Number(game.bgg_rating).toFixed(1)}/10`} pct={(Number(game.bgg_rating) / 10) * 100} tone="green" />
                  )}
                  {weight != null && (
                    <StatMeter icon="swords" label="Complexity" value={`${weight.toFixed(2)}/5`} pct={complexityPct} tone="amber" />
                  )}
                  {game.playing_time != null && (
                    <StatMeter icon="hourglass_empty" label="Time" value={timeLabel} pct={timePct} tone="green" />
                  )}
                  {playerRange && (
                    <StatMeter icon="groups" label="Players" value={playerRange} pct={(Math.min(game.max_players ?? game.min_players ?? 0, 8) / 8) * 100} tone="amber" />
                  )}
                  {game.min_age != null && (
                    <StatMeter icon="calendar_today" label="Age" value={`${game.min_age}+`} pct={(Math.min(game.min_age, 18) / 18) * 100} tone="green" />
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
    </>
  );
}
