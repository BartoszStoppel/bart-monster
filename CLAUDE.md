# Board Game Hub — bart.monster

## Overview

Board game rating and discovery site for a small friend group. Users sign in with Google, search BoardGameGeek for games, add them to a shared collection, rate them on tier lists, and compare community scores to BGG averages. Features include a game picker spinner, achievements, statistics charts, and an admin panel.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Auth + Database:** Supabase (Google OAuth, PostgreSQL with RLS)
- **Board Game Data:** BoardGameGeek XML API v2 (XML parsed with `fast-xml-parser`)
- **Drag & Drop:** `@dnd-kit` (tier list reordering, collection sorting)
- **Hosting:** Vercel (project: `bart-monster`, domain: `bart.monster`)

## Commands

```
npm run dev          # start dev server
npm run build        # production build (typecheck + build)
npm run lint         # ESLint
npm run smoke        # smoke test against local dev server
npm run smoke:prod   # smoke test against bart.monster
```

**Workflow:** after making changes, run `npm run build` (catches type errors), then `npm run lint`.

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # login page, OAuth callback route
│   ├── (app)/            # authenticated pages (behind middleware)
│   │   ├── page.tsx          # collection grid (home page)
│   │   ├── search/           # BGG game search + add to collection
│   │   ├── games/[bggId]/    # game detail, ratings, ownership, delete
│   │   ├── tier-list/        # drag-and-drop tier list (S/A/B/C/D/F)
│   │   ├── picker/           # random game picker spinner wheel
│   │   ├── statistics/       # charts (score distribution, complexity)
│   │   ├── achievements/     # user achievement badges
│   │   ├── profile/          # user profile page
│   │   ├── admin/            # admin panel (admin-only actions)
│   │   └── community/        # community view
│   └── api/bgg/             # BGG API proxy routes
│       ├── search/           # GET — search BGG by name
│       └── game/[id]/        # GET — fetch game details by BGG ID
├── components/           # shared UI (nav, game card, search bar, category toggle)
├── lib/
│   ├── supabase/server.ts    # server-side Supabase client (uses cookies)
│   ├── supabase/client.ts    # browser-side Supabase client
│   ├── bgg/client.ts         # BGG API functions (search, details, summaries)
│   ├── bgg/parser.ts         # XML → typed objects
│   ├── bgg/types.ts          # BGG API response types
│   ├── admin.ts              # isAdmin() check
│   ├── tier-colors.ts        # tier color mappings
│   └── picker-utils.ts       # picker wheel utilities
├── types/database.ts     # TypeScript types for Supabase tables
└── proxy.ts              # middleware: auth guard + cookie refresh
supabase/migrations/      # numbered SQL migration files
scripts/                  # seed script, smoke tests
archive/                  # old disco-themed site (preserved, not deployed)
```

## Database Schema

Key tables (see `supabase/migrations/` for full schema):

- **profiles** — user info + `is_admin` flag (auto-created on first login)
- **board_games** — game metadata from BGG, with `category` ("party" | "board")
- **user_game_collection** — per-user ownership/wishlist tracking
- **game_ratings** — 1–10 numeric ratings with optional comments
- **tier_placements** — S/A/B/C/D/F tier + position + computed score per user per game

Tier scores are computed client-side in `src/app/(app)/tier-list/compute-scores.ts` and saved to the `score` column.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
BGG_API_TOKEN=
```

## Conventions

### Supabase Client Usage
- **Server components / server actions / route handlers:** `import { createClient } from "@/lib/supabase/server"` — this is `async` (accesses cookies)
- **Client components:** `import { createClient } from "@/lib/supabase/client"` — call it inside `useEffect` or event handlers only, never at module scope or render time (empty env vars at build time cause crashes)

### Data Fetching
- All server-rendered pages using Supabase export `export const dynamic = "force-dynamic"`
- BGG API calls go through `/api/bgg/*` proxy routes from the client, never directly — this avoids CORS and keeps `BGG_API_TOKEN` server-side
- Server-side code can call `src/lib/bgg/client.ts` functions directly

### Auth & Middleware
- `src/proxy.ts` handles auth: unauthenticated users are redirected to `/login`, authenticated users on `/login` are redirected to `/`
- Admin-only features check `isAdmin()` from `src/lib/admin.ts`

### Styling
- Tailwind CSS v4 — use utility classes, dark mode via `dark:` prefix
- Color palette: `zinc` for neutrals, `blue` for primary actions
- The app layout wraps all `(app)` pages with the `<Nav />` component and a max-width container

### Path Alias
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
