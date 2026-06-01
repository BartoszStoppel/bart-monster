-- Store a thumbnail per word-bank expansion so the tier list can show box art
-- instead of the name. Populated from BGG when admins add expansions; NULL for
-- custom (non-BGG) entries, which fall back to showing the name.
ALTER TABLE game_expansions ADD COLUMN thumbnail_url TEXT;
