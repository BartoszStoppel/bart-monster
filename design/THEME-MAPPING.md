# Table Monsters — color → token mapping (Stage 3 sweep)

The app is **forced-dark** (`<html class="dark">` + `@custom-variant dark`). Only `dark:`
variants actually render. The goal of this sweep: replace hardcoded Tailwind palette colors
(`zinc/slate/gray/neutral`, `cyan/blue/sky`, `emerald/green`, `orange/amber`, `red/rose`,
`violet/purple/indigo/fuchsia`) with the **semantic dungeon tokens** defined in
`src/app/globals.css` (`@theme inline`).

## Golden rules
1. **Collapse light/dark pairs → one token.** e.g. `bg-white dark:bg-zinc-900` → `bg-surface-container-low`.
   Tokens are already dark; do not keep `dark:` prefixes for these.
2. **Keep semantics.** A delete button stays "destructive" (ruby/error), an "owned" badge stays
   "positive" (slime), a primary CTA stays amber. Map by *meaning*, not by hue.
3. **Don't touch** non-color classes, layout, logic, opacity-only utilities, or `bg-black/40`
   scrim overlays (those are fine as-is). Leave emoji and SVG path data alone.
4. Prefer the **primitives** where the element is one: `.stone-button` (buttons/CTAs),
   `.carved-input` (text inputs/textareas/selects), `.rune-chip` (filter/category/status pills),
   `.glass-card` / `.monster-card` (panels/cards), `.glow-amber` (hover bloom).

## Neutrals (zinc / slate / gray / neutral)
| current (any light/dark) | → token |
|---|---|
| `bg-white`, `bg-zinc-50/100/200` (light side of a pair) | drop, use the dark token below |
| `bg-zinc-900/950`, `bg-zinc-900/80` | `bg-surface-container-low` (`/80` keep opacity) |
| `bg-zinc-800` | `bg-surface-container-high` |
| `bg-zinc-700`, `bg-white/10` (hover) | `bg-surface-container-highest` |
| `bg-zinc-700/50`, hover tints | `hover:bg-surface-container-high` |
| `text-white`, `text-zinc-50/100`, `text-zinc-900` (dark pair →50) | `text-on-surface` |
| `text-zinc-300/400` | `text-on-surface-variant` |
| `text-zinc-500/600` | `text-on-surface-variant` (muted; add `/70` if it was clearly dimmer) |
| `border-zinc-200/700/800` | `border-outline-variant` |
| stronger/active border | `border-outline` |
| `divide-zinc-*`, `ring-zinc-*` | `divide-outline-variant`, `ring-outline-variant` |
| `placeholder-zinc-*` | `placeholder-on-surface-variant/60` |

## Primary accent (cyan / blue / sky used as the interactive accent)
| current | → token |
|---|---|
| `text-cyan-*` / `text-blue-*` (link/accent) | `text-primary` |
| `bg-cyan-*` / `bg-blue-*` (accent fill / active) | `bg-primary-container` + `text-on-primary-container` |
| `border-cyan/blue-*`, `ring-cyan/blue-*` | `border-primary`, `ring-primary` |
| `hover:text-cyan-*` etc. | `hover:text-primary` |
| `bg-cyan-500/10` faint accent wash | `bg-primary-container/10` |

## Positive / owned / success (emerald / green)
| current | → token |
|---|---|
| `text-emerald/green-*` | `text-secondary` (slime) |
| `bg-emerald/green-*` fill | `bg-secondary-container` + `text-on-secondary-container` |
| faint success wash `bg-emerald-500/10` | `bg-secondary-container/10` |
| `border-emerald/green-*` | `border-secondary-container` |

## Wishlist / warning (orange / amber as accent)
Wishlist = torch amber (established in `game-card.tsx`).
| current | → token |
|---|---|
| `text-orange/amber-*` | `text-primary` |
| `bg-orange/amber-*` | `bg-primary-container` + `text-on-primary-container` |

## Destructive / error (red / rose)
| current | → token |
|---|---|
| `text-red/rose-*` | `text-error` (or `text-tertiary` for softer threat labels) |
| `bg-red/rose-*` solid (delete CTA) | `bg-error-container` + `text-on-error-container` |
| faint danger wash `bg-red-500/10` | `bg-error-container/15` |
| `border-red/rose-*` | `border-error` / `border-tertiary` |

## Misc decorative accent (violet / purple / indigo / fuchsia, NON-chart/NON-rank)
Default these to **amber** (`text-primary` / `bg-primary-container`) unless they encode a distinct
positive meaning (then slime) or threat (then ruby). When in doubt: amber.

---

## Loot-rarity gradient — ranks.ts, tier-colors.ts, charts
These are deliberate **multi-hue spectrums**; do NOT collapse to one token. Recolor into a
game-loot rarity scale, darkened for grim-dark. Bands, low→high:

| band | hue family | dark style pattern (this is what renders) | light pair |
|---|---|---|---|
| Common (stone) | `stone` | `dark:bg-stone-800/40 dark:text-stone-300` | `bg-stone-200 text-stone-700` |
| Uncommon (slime) | `lime` | `dark:bg-lime-900/30 dark:text-lime-300` | `bg-lime-100 text-lime-800` |
| Rare (arcane blue) | `sky` | `dark:bg-sky-900/30 dark:text-sky-300` | `bg-sky-100 text-sky-800` |
| Epic (violet) | `violet` | `dark:bg-violet-900/30 dark:text-violet-300` | `bg-violet-100 text-violet-800` |
| Legendary (gold) | `amber` | `dark:bg-amber-900/30 dark:text-amber-200` | `bg-amber-100 text-amber-800` |

- **ranks.ts RANKS + ADJECTIVES (each ~49 entries, ordered high→low):** split into the 5 bands by
  rank position. Top ~10 → Legendary gold; next → Epic violet; next → Rare blue; next → Uncommon
  slime; bottom ~12 → Common stone. Ramp shade/opacity within a band for progression (e.g. top
  legendary brighter: `dark:text-amber-100`, glow). Keep the `color` (light) + `darkColor` (dark) shape.
- **tier-colors.ts:** `S→ruby` (`bg-rose-600`/red), `A→amber` (`bg-amber-500`), `B→gold`
  (`bg-yellow-500`), `C→slime` (`bg-lime-500`), `D→blue` (`bg-sky-600`), `F→stone` (`bg-stone-600`).
- **charts (statistics/*):** use up to 4 distinguishable on-theme hues — amber `#ffb347`,
  slime `#75fd00`, ruby `#a30113`, stone/tan `#9f8e7c` — instead of cyan/violet/emerald/orange.
  Keep bars/lines readable on the dark surface.

## Reference components (already done — match their style)
- `src/components/game-card.tsx` — owned=slime, wishlist=amber, "Ours"=amber/BGG=stone, `font-stat` stat row.
- `src/app/globals.css` — token + primitive definitions.
</invoke>
