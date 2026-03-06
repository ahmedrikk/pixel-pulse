-- Run each block separately if needed

-- Block 1: Create table
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

-- Block 2: Indexes
CREATE INDEX IF NOT EXISTS idx_cached_articles_expires_at ON public.cached_articles(expires_at);

-- Block 3: RLS
ALTER TABLE public.cached_articles ENABLE ROW LEVEL SECURITY;

-- Block 4: Drop old policies
DROP POLICY IF EXISTS anon_read ON public.cached_articles;
DROP POLICY IF EXISTS auth_write ON public.cached_articles;
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.cached_articles;
DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cached_articles;

-- Block 5: Create policies (simple names, no spaces)
CREATE POLICY anon_read ON public.cached_articles FOR SELECT USING (true);

-- Block 6: Auth policy
CREATE POLICY auth_write ON public.cached_articles FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Block 7: Function
CREATE OR REPLACE FUNCTION cleanup_expired_articles() RETURNS void AS $$ BEGIN DELETE FROM public.cached_articles WHERE expires_at < NOW(); END; $$ LANGUAGE plpgsql;
