-- ============================================
-- ADD GAMIFICATION & CUSTOMIZATION TO PROFILES
-- ============================================

-- 1. Add new columns to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS daily_bonus_claimed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS nameplate_url TEXT;

-- 2. Update existing rows to have default values for the new columns
UPDATE public.profiles
SET xp = 0, level = 1, daily_streak = 0
WHERE xp IS NULL OR level IS NULL OR daily_streak IS NULL;
