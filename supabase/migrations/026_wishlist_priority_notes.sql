ALTER TABLE user_game_collection
  ADD COLUMN IF NOT EXISTS wishlist_priority INTEGER CHECK (wishlist_priority >= 1 AND wishlist_priority <= 3),
  ADD COLUMN IF NOT EXISTS wishlist_note TEXT;
