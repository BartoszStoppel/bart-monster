/**
 * BoardGameGeek logo as a monochrome inline SVG (Simple Icons path). It
 * inherits `currentColor` so it themes like the Material Symbol icons instead
 * of clashing with the colour raster logo. Use this everywhere a BGG mark sits
 * next to themed text/icons; the `public/bgg-icon.png` raster is reserved for
 * spots that want the official colours.
 */
export function BggMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="m19.7 4.44-2.38.64L19.65 0 4.53 5.56l.83 6.67-1.4 1.34L8.12 24l8.85-3.26 3.07-7.22-1.32-1.27.98-7.81Z" />
    </svg>
  );
}
