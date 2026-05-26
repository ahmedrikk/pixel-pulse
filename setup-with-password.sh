#!/bin/bash
# Pixel Pulse Database Setup
# Usage: ./setup-with-password.sh YOUR_DB_PASSWORD

if [ -z "$1" ]; then
  echo "Usage: ./setup-with-password.sh YOUR_SUPABASE_DB_PASSWORD"
  echo ""
  echo "Get your password from:"
  echo "1. https://supabase.com/dashboard/project/jdubbuamzgwfuxhvuebl/settings/database"
  echo "2. Copy the password from 'Connection string'"
  exit 1
fi

PASSWORD="$1"
HOST="db.zxcqqsviwtwxukizibef.supabase.co"
DB="postgres"
USER="postgres"

echo "🔧 Setting up Pixel Pulse database..."

# Create the table
PGPASSWORD="$PASSWORD" psql \
  "host=$HOST port=5432 dbname=$DB user=$USER sslmode=require" << 'SQL'

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cached_articles_expires_at ON public.cached_articles(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_articles_source ON public.cached_articles(source);
CREATE INDEX IF NOT EXISTS idx_cached_articles_category ON public.cached_articles(category);

-- Security
ALTER TABLE public.cached_articles ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.cached_articles;
CREATE POLICY "Allow anonymous read access" ON public.cached_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cached_articles;
CREATE POLICY "Allow authenticated insert/update" ON public.cached_articles FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_articles() RETURNS void AS $$ BEGIN DELETE FROM public.cached_articles WHERE expires_at < NOW(); END; $$ LANGUAGE plpgsql;

SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Database setup complete!"
  echo "   The cached_articles table has been created."
  echo ""
else
  echo ""
  echo "❌ Setup failed. Please check your password and try again."
  echo "   You can also use the SQL Editor in Supabase Dashboard."
fi
