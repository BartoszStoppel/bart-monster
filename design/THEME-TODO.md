# Table Monsters theme — TODO (resume later today)

Reskinning bart.monster → grim-dark "Dungeon Crawler" theme.
Design source: `design/DESIGN.md` (spec), `design/code.html` (Tailwind reference), `design/screen.png` (mockup).
All theme values are tokens in `src/app/globals.css` (`@theme inline`) — tune from that one file.

## ✅ Done
- [x] **Stage 1 — Foundation**: dungeon palette tokens, 3 fonts (EB Garamond / Hanken Grotesk / Geist),
      forced dark (`<html class="dark">` + `@custom-variant dark`), stone-noise + torch-amber backdrop,
      `.glass-card`→monster-card reforge, new `.carved-input` / `.rune-chip` / `.stone-button` /
      `.stat-icon` / `.monster-card-frame` primitives, title → "Table Monsters". (`globals.css`, `layout.tsx`)
- [x] **Stage 2 — Monster card** (`src/components/game-card.tsx`): cyan/zinc/emerald/violet/orange →
      dungeon tokens; owned=slime-green, wishlist=torch-amber, "Ours"=amber / BGG=stone; stat row in
      `font-stat`; serif title; art→stone fade.

## ⏳ Stage 3 — remaining component sweep
- [ ] **Nav / card-hand** (`src/components/nav.tsx`) — dungeon tokens; consider serif "TABLE MONSTERS" wordmark in `text-primary`
- [ ] **Login page** (`src/app/login/…`) — backdrop already themed; restyle the sign-in button → `.stone-button`, card → `.glass-card`
- [ ] **Buttons** site-wide → `.stone-button` (amber text, forged plate)
- [ ] **Inputs / search** → `.carved-input` (recessed, slime-green focus)
- [ ] **Filter / category pills** → `.rune-chip` (amber when active)
- [ ] **`(app)` pages**: tier-list, wishlist, community, picker, search, game detail `[bggId]` — remap remaining `cyan-*`/`zinc-*`/`emerald`/`violet`/`orange`
- [ ] Optional: rarity header on cards (could map tier S/A/B/C/D/F → Legendary/Epic/Rare/…); `.monster-card-frame` inset border on the game **detail** page card (too busy on the dense grid)

## ❓ Open questions for Bart (review in browser first)
- Does the direction land? (palette / fonts / card feel) — eyeball http://localhost:3000 (/login, then the Library after sign-in)
- Tuning knobs if needed: **amber glow intensity**, **card corner radius** (currently `rounded-lg`; design calls for sharper ~4px), **how strongly the stone texture shows**
- Commit `design/` reference folder to the repo? (currently untracked)
- Push the pnpm commit (`7a23f75`)? → flips Vercel builds to pnpm

## ▶️ How to resume
```bash
cd ~/dev/bart-monster
PATH="$HOME/.local/share/pnpm/bin:$PATH" pnpm dev   # http://localhost:3000
```
- Env is set (`.env.local`, pulled from Vercel prod). Vercel CLI linked. pnpm is the package manager.
- find leftover non-theme colors:  `grep -rnE "cyan-|zinc-|emerald-|violet-|orange-" src/`
- Memory: `table-monsters-theme.md` has the full context.
