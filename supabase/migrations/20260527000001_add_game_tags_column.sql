-- Add game_tags column to cached_articles
-- Stores only game title tags (separate from the full tags array)
-- so the frontend can pass clean game names straight to RAWG.
ALTER TABLE cached_articles
  ADD COLUMN IF NOT EXISTS game_tags TEXT[] DEFAULT '{}';
