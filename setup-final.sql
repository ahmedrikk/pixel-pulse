-- PIXEL PULSE - NEWS CACHE DATABASE SETUP
-- Run this in: https://supabase.com/dashboard/project/zxcqqsviwtwxukizibef/sql-editor

CREATE TABLE IF NOT EXISTS public.cached_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Staff Writer',
    ai_title TEXT,
    ai_summary TEXT,
    tags TEXT[] DEFAULT '{}',
    likes INTEGER DEFAULT 0,
    article_date TIMESTAMP WITH TIME ZONE NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT unique_source_url UNIQUE (source_url)
);

CREATE INDEX IF NOT EXISTS idx_cached_articles_expires_at ON public.cached_articles(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_articles_source ON public.cached_articles(source);
CREATE INDEX IF NOT EXISTS idx_cached_articles_category ON public.cached_articles(category);

ALTER TABLE public.cached_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read access" ON public.cached_articles;
CREATE POLICY "Allow anonymous read access" ON public.cached_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cached_articles;
CREATE POLICY "Allow authenticated insert/update" ON public.cached_articles FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION cleanup_expired_articles() RETURNS void AS $$ 
BEGIN 
    DELETE FROM public.cached_articles WHERE expires_at < NOW(); 
END; 
$$ LANGUAGE plpgsql;

SELECT '✅ cached_articles table created successfully!' as status;
