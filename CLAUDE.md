# Board Game Hub — bart.monster

## Overview

Board game rating and discovery site for a small friend group. Users sign in with Google, search BoardGameGeek for games, add them to a shared collection, rate them, and compare community ratings to BGG averages.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Auth + Database:** Supabase (Google OAuth, PostgreSQL with RLS)
- **Board Game Data:** BoardGameGeek XML API v2
- **Hosting:** Vercel (project: `bart-monster`)

## Key Directories

- `src/app/(auth)/` — login page, OAuth callback
- `src/app/(app)/` — authenticated pages (collection, search, game detail, statistics, profile)
- `src/app/api/bgg/` — BGG API proxy routes (avoids CORS, keeps token server-side)
- `src/lib/supabase/` — Supabase client factories (browser + server)
- `src/lib/bgg/` — BGG API client, XML parser, types
- `src/components/` — shared UI components
- `supabase/migrations/` — database schema SQL
- `archive/` — old disco-themed site assets (preserved, not deployed)

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
BGG_API_TOKEN=
```

## Conventions

- Server components use `src/lib/supabase/server.ts`; client components use `src/lib/supabase/client.ts`
- Client components must only call `createClient()` inside `useEffect` or event handlers (not at render time) to avoid build-time failures with empty env vars
- All server-rendered pages using Supabase export `dynamic = "force-dynamic"`
- BGG API calls go through `/api/bgg/*` proxy routes, never directly from the client
