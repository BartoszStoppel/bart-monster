// Re-mounts on every navigation into a game page, so the entrance animation
// (see .game-open-anim in globals.css) replays each time a monster card opens.
export default function GameTemplate({ children }: { children: React.ReactNode }) {
  return <div className="game-open-anim">{children}</div>;
}
