#!/bin/bash
# Pixel Pulse Database Setup Script
# This will create the cached_articles table

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "DB_PASSWORD must be supplied through the environment."
  exit 1
fi
DB_HOST="db.zxcqqsviwtwxukizibef.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"

echo "🔧 Setting up Pixel Pulse database..."
echo ""

# Test connection first
echo "Testing connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql "host=$DB_HOST port=5432 dbname=$DB_NAME user=$DB_USER sslmode=require" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Connection failed!"
  echo ""
  echo "The password might be incorrect. Please:"
  echo "1. Go to https://supabase.com/dashboard/project/jdubbuamzgwfuxhvuebl/settings/database"
  echo "2. Find the correct password"
  echo "3. Export DB_PASSWORD for this shell and run the script again"
  exit 1
fi

echo "✅ Connected successfully!"
echo ""
echo "Creating table..."

PGPASSWORD="$DB_PASSWORD" psql "host=$DB_HOST port=5432 dbname=$DB_NAME user=$DB_USER sslmode=require" << 'SQL'
-- Create table for cached news articles
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cached_articles_expires_at ON public.cached_articles(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_articles_source ON public.cached_articles(source);
CREATE INDEX IF NOT EXISTS idx_cached_articles_category ON public.cached_articles(category);

-- Enable Row Level Security
ALTER TABLE public.cached_articles ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.cached_articles;
CREATE POLICY "Allow anonymous read access" ON public.cached_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cached_articles;
DROP POLICY IF EXISTS "Service role manages articles" ON public.cached_articles;
CREATE POLICY "Service role manages articles" ON public.cached_articles FOR ALL
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_articles() RETURNS void AS $$ 
BEGIN 
    DELETE FROM public.cached_articles WHERE expires_at < NOW(); 
END; 
$$ LANGUAGE plpgsql;

-- Verify
SELECT 'Table created successfully!' as status;
SQL

echo ""
echo "✅ Setup complete! Your news caching is now active."
echo ""
echo "🚀 Next steps:"
echo "   1. Refresh your app at http://localhost:8080"
echo "   2. Articles will now load instantly from cache"
echo "   3. New articles will be AI-processed in the background"
