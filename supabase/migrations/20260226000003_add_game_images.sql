-- Add image_url to user_games
ALTER TABLE public.user_games
ADD COLUMN IF NOT EXISTS image_url TEXT;
