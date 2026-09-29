# Archived monster site

The original dancing-monster and map experiment is preserved here. This is historical material, excluded from Vercel and Docker builds; it is not part of the current Rust/Axum and React/Vite board-game application.

- `public/index.html`: monster page.
- `public/map.html`: map experiment.
- `public/sprites/`: original character, animation and map assets.
- Package files belong to that experiment, not the current application's build.

Serve `archive/public` with a static HTTP server to view it locally. These pages have no board-game rankings, daily history or Supabase tables. The archived code/assets are unchanged.

The later Next.js board-game dashboard is preserved separately in Git at `091d2461f1bf47a6b3b78af7d62275050f33bb20`; its original layout/components are reused by the Rust application's frontend with a brown palette. The intervening Django runtime is recoverable at `9a1596e`. It is not required to build or run the current application.

See [the project README](../README.md), [data/deployment guide](../docs/django-migration.md), [Supabase audit](../docs/supabase-audit.md), and [difficulty behavior](../docs/difficulty-rating-plan.md). Current features are separate from this static archive, and personal story/email material remains preserved.
