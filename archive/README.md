# Archived monster site

The original dancing-monster and map experiment is preserved here. This directory is historical material and is not used by the Django board-game hub now live on Vercel with Supabase. `.vercelignore` excludes the archive from deployments.

- `public/index.html`: the monster page.
- `public/map.html`: the map experiment.
- `public/sprites/`: the original character, animation, and map assets.
- The package files belong to that earlier experiment; they are not dependencies or build steps for the current app.

To view the static archive locally, serve its public directory from the repository root:

```sh
python3 -m http.server 8001 --directory archive/public
```

Open http://127.0.0.1:8001 or http://127.0.0.1:8001/map.html. The archive has no board-game ratings, history storage, or hot-take controls; those features belong to the Django app described in the [project README](../README.md).

The later Next.js board-game app is preserved separately in Git at `091d2461f1bf47a6b3b78af7d62275050f33bb20`. See [the migration guide](../docs/django-migration.md) and [refactor results](../docs/refactor-results.md) for the current replacement. This documentation update leaves the archived code and assets unchanged.

The [Supabase audit](../docs/supabase-audit.md) and [daily-history/database cleanup](../docs/django-migration.md) concern the later board-game database. Its Django replacement consolidates user–game state and stores daily scores; the static archive has no tables or score history to migrate.

The current hub also has independent enjoyment and difficulty rankings, with community difficulty replacing BGG complexity in application features. The [difficulty design](../docs/difficulty-rating-plan.md) describes this addition; the static archive is unaffected.
