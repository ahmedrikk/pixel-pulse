-- Reset Season 1 battle-pass progress so all users start at Tier 1.
-- Lifetime XP (xp), level, and streaks are preserved.
-- Run once before public launch or when starting a fresh season.

-- 1. Fix column default: tier starts at 1 (free), not 0
ALTER TABLE public.profiles
  ALTER COLUMN tier SET DEFAULT 1;

-- 2. Reset all users to Season 1 starting state (must happen before constraint update)
UPDATE public.profiles
SET
  xp_season = 0,
  tier      = 1;

-- Update check constraint to reflect 1-based tier
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS tier_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT tier_range CHECK (tier >= 1 AND tier <= 25);

-- 3. Clear previously claimed rewards from test data
--    so users can claim fresh rewards as they re-progress
DELETE FROM public.user_rewards;

-- 4. Clear XP events so dedup keys reset (users can re-earn from a clean slate)
DELETE FROM public.xp_events;
