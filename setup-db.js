#!/usr/bin/env node
/**
 * Database Setup Script for Pixel Pulse
 * Creates the cached_articles table in Supabase
 * 
 * Usage: node setup-db.js
 */

const SUPABASE_URL = "https://jdubbuamzgwfuxhvuebl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJidWFtemd3ZnV4aHZ1ZWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NTkwODAsImV4cCI6MjA4NTEzNTA4MH0.0uB7V17zXwVOWQl5JgVISugy-X9NCwj9aQJbem_UOfg";

const SQL = `
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

CREATE INDEX IF NOT EXISTS idx_cached_articles_expires_at ON public.cached_articles(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_articles_source ON public.cached_articles(source);
CREATE INDEX IF NOT EXISTS idx_cached_articles_category ON public.cached_articles(category);

ALTER TABLE public.cached_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read access" ON public.cached_articles;
CREATE POLICY "Allow anonymous read access" ON public.cached_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cached_articles;
CREATE POLICY "Allow authenticated insert/update" ON public.cached_articles FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION cleanup_expired_articles() RETURNS void AS $$ BEGIN DELETE FROM public.cached_articles WHERE expires_at < NOW(); END; $$ LANGUAGE plpgsql;
`;

async function setupDatabase() {
  console.log("🔧 Setting up Pixel Pulse database...\n");
  
  try {
    // Try to execute SQL via Supabase REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
        "Prefer": "resolution=ignore-duplicates",
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log("⚠️  Could not auto-setup (this is normal).");
      console.log("   Please run the SQL manually in Supabase Dashboard.\n");
      console.log("📋 Instructions:");
      console.log("   1. Go to https://supabase.com/dashboard");
      console.log("   2. Select your project");
      console.log("   3. Click 'SQL Editor' in the left menu");
      console.log("   4. Click 'New query'");
      console.log("   5. Paste the contents of: setup-database.sql");
      console.log("   6. Click 'Run'\n");
      return;
    }

    console.log("✅ Database setup complete!");
    console.log("   The cached_articles table has been created.\n");
    
  } catch (error) {
    console.log("⚠️  Auto-setup failed. Please run SQL manually.");
    console.log("   See setup-database.sql for the SQL script.\n");
  }
}

// Alternative: Use Supabase Management API if available
async function checkTableExists() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cached_articles?limit=0`, {
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
    });
    
    if (response.status === 200) {
      console.log("✅ cached_articles table already exists!");
      return true;
    }
  } catch (e) {
    // Ignore error
  }
  return false;
}

// Run setup
checkTableExists().then(exists => {
  if (!exists) {
    setupDatabase();
  }
});
