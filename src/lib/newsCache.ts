/**
 * News Cache Service
 * Handles caching of processed articles in Supabase
 * - Fetches from cache first (instant loading)
 * - Only processes new/expired articles with AI
 * - Keeps content consistent until cache expires (24 hours)
 */

import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/data/mockNews";

export interface CachedArticle {
  id: string;
  original_id: string;
  title: string;
  summary: string;
  source_url: string;
  image_url: string;
  og_image_url: string | null;
  category: string;
  source: string;
  author: string;
  ai_title: string | null;
  ai_summary: string | null;
  tags: string[];
  likes: number;
  article_date: string;
  fetched_at: string;
  expires_at: string;
}

const CACHE_DURATION_HOURS = 24;

/**
 * Convert NewsItem to database format
 */
function toDbFormat(article: NewsItem, expiresAt: Date): Omit<CachedArticle, 'id' | 'fetched_at'> {
  return {
    original_id: article.id,
    title: article.title,
    summary: article.summary,
    source_url: article.sourceUrl,
    image_url: article.imageUrl,
    category: article.category,
    source: article.source,
    author: article.author,
    ai_title: null,
    ai_summary: null,
    tags: article.tags,
    likes: article.likes || 0,
    article_date: article.timestamp,
    expires_at: expiresAt.toISOString(),
  };
}

function cap100Words(text: string): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 65) return text;
  return words.slice(0, 60).join(" ");
}

/**
 * Convert database format to NewsItem
 */
function toNewsItem(article: CachedArticle): NewsItem {
  return {
    id: article.original_id,
    title: article.ai_title || article.title,
    summary: cap100Words(article.ai_summary || article.summary),
    sourceUrl: article.source_url,
    // Prefer OG image (from full page fetch) over RSS feed image
    imageUrl: article.og_image_url || article.image_url,
    category: article.category,
    timestamp: article.article_date,
    source: article.source,
    author: article.author,
    tags: article.tags,
    likes: article.likes,
  };
}

/**
 * Check which articles are already cached
 * Returns cached articles and uncached URLs
 */
export async function getCachedArticles(urls: string[]): Promise<{
  cached: NewsItem[];
  uncachedUrls: string[];
}> {
  if (urls.length === 0) {
    return { cached: [], uncachedUrls: [] };
  }

  try {
    const { data, error } = await supabase
      .from('cached_articles')
      .select('*')
      .in('source_url', urls)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching cached articles:', error);
      return { cached: [], uncachedUrls: urls };
    }

    const cachedUrls = new Set(data?.map(a => a.source_url) || []);
    const uncachedUrls = urls.filter(url => !cachedUrls.has(url));

    return {
      cached: (data || []).map(toNewsItem),
      uncachedUrls,
    };
  } catch (err) {
    console.error('Cache lookup error:', err);
    return { cached: [], uncachedUrls: urls };
  }
}

/**
 * Save articles to cache
 */
export async function saveArticlesToCache(articles: NewsItem[]): Promise<void> {
  if (articles.length === 0) return;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + CACHE_DURATION_HOURS);

  const dbArticles = articles.map(article => toDbFormat(article, expiresAt));

  try {
    // Use upsert to handle conflicts (update if exists, insert if not)
    const { error } = await supabase
      .from('cached_articles')
      .upsert(dbArticles, {
        onConflict: 'source_url',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error saving to cache:', error);
    } else {
      console.log(`Cached ${articles.length} articles`);
    }
  } catch (err) {
    console.error('Cache save error:', err);
  }
}

/**
 * Update cached articles with AI-processed data
 */
export async function updateArticlesWithAI(
  articles: { sourceUrl: string; aiTitle?: string; aiSummary?: string; tags: string[]; ogImage?: string | null }[]
): Promise<void> {
  if (articles.length === 0) return;

  try {
    for (const article of articles) {
      const updatePayload: Record<string, unknown> = {
        ai_title: article.aiTitle || null,
        ai_summary: article.aiSummary || null,
        tags: article.tags,
      };
      // Only write og_image_url when we actually got one (don't overwrite with null)
      if (article.ogImage) {
        updatePayload.og_image_url = article.ogImage;
      }

      const { error } = await supabase
        .from('cached_articles')
        .update(updatePayload)
        .eq('source_url', article.sourceUrl);

      if (error) {
        console.error(`Error updating article ${article.sourceUrl}:`, error);
      }
    }

    console.log(`Updated ${articles.length} articles with AI data`);
  } catch (err) {
    console.error('AI update error:', err);
  }
}

/**
 * Get all cached articles (for initial load)
 */
export async function getAllCachedArticles(): Promise<NewsItem[]> {
  try {
    const { data, error } = await supabase
      .from('cached_articles')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('article_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching all cached articles:', error);
      return [];
    }

    return (data || []).map(toNewsItem);
  } catch (err) {
    console.error('Get all cached error:', err);
    return [];
  }
}

/**
 * Clean up expired articles
 */
export async function cleanupExpiredArticles(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('cleanup_expired_articles');
    
    if (error) {
      // If RPC doesn't exist, fallback to delete
      await supabase
        .from('cached_articles')
        .delete()
        .lt('expires_at', new Date().toISOString());
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}

/**
 * Check if cache needs refresh (articles are expiring soon)
 */
export async function shouldRefreshCache(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('cached_articles')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString()); // Expires within 1 hour

    if (error) return true;
    return count === 0; // Refresh if no valid cached articles
  } catch {
    return true;
  }
}
