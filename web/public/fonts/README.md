# Original Table Monsters fonts

The three Latin WOFF2 files are byte-for-byte copies of the original Next.js
Table Monsters deployment's font assets, recovered on 2026-09-29. They match
`src/app/layout.tsx` at Git commit `9d2a3fb2729d37698226bea4f41f930c280a0a38`:

- EB Garamond, display headings, weights 600 and 700.
- Hanken Grotesk, body copy, weights 400 and 500.
- Geist, statistics, weights 500 and 600.

The original asset filenames were respectively
`e4505858a30c79c2-s.p.0f58a291.woff2`,
`c47649aa31f9e140-s.p.7e59dfd6.woff2`, and
`caa3a2e1cccd8315-s.p.3b6cae6d.woff2`.

| File | SHA-256 |
| --- | --- |
| `eb-garamond-latin.woff2` | `79d17b52365a2d5bd8995c8c54939d384e9888ed2038c7201fd8d4118d6f0a35` |
| `hanken-grotesk-latin.woff2` | `1f21c6eaa0000f3329cfcfac966b43d5bebf5aa610303e33294ac31bc6f4bb59` |
| `geist-latin.woff2` | `9b6f5ff45b278c744b5f379a2c4ecbaf858a842b8eaf82ac8d21b699ca16c608` |

These text fonts use the SIL Open Font License 1.1. The adjacent `*-OFL.txt`
files come from the official [Google Fonts source repository](https://github.com/google/fonts/tree/main/ofl),
with copyright notices matching the embedded font metadata.

`material-symbols-outlined.woff2` is the official Google Material Symbols
Outlined variable font (optical size 20–48, weight 100–700, fill 0–1, grade
−50–200), subset through the Google Fonts API to the icon names listed in
`material-symbols-icons.txt`. This preserves the original icon styling without
shipping the entire icon library. It uses the Apache License 2.0; the adjacent
`material-symbols-LICENSE.txt` is from the official
[Material Design Icons repository](https://github.com/google/material-design-icons).

When adding an icon name, regenerate this subset with the alphabetically sorted
names in the `icon_names` parameter of the
[Google Fonts Material Symbols API](https://developers.google.com/fonts/docs/material_symbols#optimize_the_icon_font).
Keep all four font families self-hosted. No runtime Google Fonts request is
needed. The CSS declarations and fallback metrics are in `src/app/globals.css`.
