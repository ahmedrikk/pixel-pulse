-- ============================================
-- PIXEL PULSE - NEWS CACHE DATABASE SETUP
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create table for cached news articles
CREATE TABLE IF NOT EXISTS public.cached_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Original article data
    original_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    category TEXT NOT NULL,
    
    -- Source info
    source TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Staff Writer',
    
    -- AI-processed data
    ai_title TEXT,
    ai_summary TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Engagement
    likes INTEGER DEFAULT 0,
    
    -- Timestamps
    article_date TIMESTAMP WITH TIME ZONE NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Unique constraint to prevent duplicates
    CONSTRAINT unique_source_url UNIQUE (source_url)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cached_articles_expires_at 
    ON public.cached_articles(expires_at);

CREATE INDEX IF NOT EXISTS idx_cached_articles_source 
    ON public.cached_articles(source);

CREATE INDEX IF NOT EXISTS idx_cached_articles_category 
    ON public.cached_articles(category);

-- Enable Row Level Security
ALTER TABLE public.cached_articles ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous read access
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.cached_articles;
CREATE POLICY "Allow anonymous read access" ON public.cached_articles
    FOR SELECT USING (true);

-- Create policy for authenticated insert/update (for the edge function)
DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cached_articles;
CREATE POLICY "Allow authenticated insert/update" ON public.cached_articles
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Create function to clean up expired articles
CREATE OR REPLACE FUNCTION cleanup_expired_articles()
RETURNS void AS $$
BEGIN
    DELETE FROM public.cached_articles WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE public.cached_articles IS 
'Cached gaming news articles with AI-generated summaries and tags. 
Articles expire after 24 hours and are re-fetched fresh.';

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- The table is now ready to use.
-- Articles will be automatically cached for 24 hours.
-- ============================================
-- ADD GAMIFICATION & CUSTOMIZATION TO PROFILES
-- ============================================

-- 1. Add new columns to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS daily_bonus_claimed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS nameplate_url TEXT;

-- 2. Update existing rows to have default values for the new columns
UPDATE public.profiles
SET xp = 0, level = 1
WHERE xp IS NULL OR level IS NULL;
