import type {
  BoardGame,
  SuggestedPlayerCount,
  BggExpansionRef,
} from "@/types/database";
import Link from "next/link";

interface BggDetailsProps {
  game: BoardGame;
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1">
        {[...new Set(items)].map((item) => (
          <span
            key={item}
            className="rune-chip rounded-full px-2 py-0.5 text-xs text-on-surface-variant"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-lg px-3 py-2">
      <span className="font-stat text-lg font-bold text-on-surface">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

export function SuggestedPlayersTable({ data }: { data: SuggestedPlayerCount[] }) {
  if (data.length === 0) return null;

  const meaningful = data.filter(
    (d) => d.best + d.recommended + d.notRecommended > 0
  );
  if (meaningful.length === 0) return null;

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Suggested Player Count
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {meaningful.map((d) => {
          const total = d.best + d.recommended + d.notRecommended;
          const bestPct = Math.round((d.best / total) * 100);
          const recPct = Math.round((d.recommended / total) * 100);
          const isBest = bestPct >= 40;
          const isRec = bestPct + recPct >= 50;
          return (
            <div
              key={d.numPlayers}
              className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs ${
                isBest
                  ? "border-secondary-container bg-secondary-container/15"
                  : isRec
                    ? "border-primary bg-primary-container/15"
                    : "border-outline-variant bg-surface-container-high"
              }`}
            >
              <span className="font-stat font-bold text-on-surface">
                {d.numPlayers}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isBest
                    ? "text-secondary"
                    : isRec
                      ? "text-primary"
                      : "text-on-surface-variant"
                }`}
              >
                {isBest ? "Best" : isRec ? "Good" : "Meh"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpansionList({ expansions }: { expansions: BggExpansionRef[] }) {
  if (expansions.length === 0) return null;

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Expansions ({expansions.length})
      </h3>
      <div className="flex flex-wrap gap-1">
        {expansions.map((exp) => (
          <Link
            key={exp.id}
            href={`https://boardgamegeek.com/boardgameexpansion/${exp.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rune-chip rounded-full px-2 py-0.5 text-xs text-on-surface-variant transition-colors"
          >
            {exp.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BggDetails({ game }: BggDetailsProps) {
  const hasDesigners = game.designers?.length > 0;
  const hasArtists = game.artists?.length > 0;
  const hasPublishers = game.publishers?.length > 0;
  const hasMechanics = game.mechanics?.length > 0;
  const hasExpansions = game.expansions?.length > 0;
  const hasAlternateNames = game.alternate_names?.length > 0;
  const hasStats =
    game.bgg_users_rated || game.bgg_owned || game.bgg_wanting || game.bgg_wishing;

  if (
    !hasDesigners &&
    !hasArtists &&
    !hasPublishers &&
    !hasMechanics &&
    !hasExpansions &&
    !hasStats
  ) {
    return null;
  }

  return (
    <div className="space-y-5">
      {hasDesigners && (
        <div className="text-sm text-on-surface-variant">
          <span className="text-on-surface-variant/70">Designed by </span>
          {game.designers.join(", ")}
        </div>
      )}

      {hasArtists && (
        <div className="text-sm text-on-surface-variant">
          <span className="text-on-surface-variant/70">Art by </span>
          {game.artists.join(", ")}
        </div>
      )}

      {hasPublishers && (
        <div className="text-sm text-on-surface-variant">
          <span className="text-on-surface-variant/70">Published by </span>
          {game.publishers.join(", ")}
        </div>
      )}

      {hasStats && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            BGG Community
          </h3>
          <div className="flex flex-wrap gap-2">
            {game.bgg_users_rated ? (
              <StatItem label="Ratings" value={game.bgg_users_rated} />
            ) : null}
            {game.bgg_std_dev ? (
              <StatItem label="Std Dev" value={Number(game.bgg_std_dev).toFixed(2)} />
            ) : null}
            {game.bgg_owned ? (
              <StatItem label="Owned" value={game.bgg_owned} />
            ) : null}
            {game.bgg_wanting ? (
              <StatItem label="Wanting" value={game.bgg_wanting} />
            ) : null}
            {game.bgg_wishing ? (
              <StatItem label="Wishing" value={game.bgg_wishing} />
            ) : null}
            {game.bgg_num_weights ? (
              <StatItem label="Weight Votes" value={game.bgg_num_weights} />
            ) : null}
          </div>
        </div>
      )}

      {(game.suggested_age || game.language_dependence) && (
        <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
          {game.suggested_age && (
            <span>
              <span className="text-on-surface-variant/70">Community age: </span>
              {game.suggested_age}+
            </span>
          )}
          {game.language_dependence && (
            <span>
              <span className="text-on-surface-variant/70">Language: </span>
              {game.language_dependence}
            </span>
          )}
        </div>
      )}

      <TagList label="Mechanics" items={game.mechanics ?? []} />
      <ExpansionList expansions={game.expansions ?? []} />
      {hasAlternateNames && (
        <TagList label="Also Known As" items={game.alternate_names} />
      )}
    </div>
  );
}
