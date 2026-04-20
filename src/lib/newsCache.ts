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
  if (words.length <= 100) return text;
  return words.slice(0, 100).join(" ");
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
    fetchedAt: article.fetched_at,
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
 * Spotify-style shuffle:
 * 1. Fisher-Yates with a time-based seed → different order every page load
 * 2. Source-spreading pass → no two consecutive articles from the same outlet
 */
/**
 * Fetch engagement weights for a list of article URLs.
 * Returns a Map<sourceUrl, score> based on reads + likes in the last 7 days.
 * Accepts an optional userId to add a per-user bias (Phase 3 ready).
 */
export async function getEngagementWeights(
  urls: string[],
  userId?: string
): Promise<Map<string, number>> {
  if (urls.length === 0) return new Map();

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('article_reads')
      .select('article_url, action_type, user_id')
      .in('article_url', urls)
      .gte('read_date', sevenDaysAgo);

    if (error || !data) return new Map();

    const scores = new Map<string, number>();
    for (const row of data) {
      const prev = scores.get(row.article_url) ?? 0;
      // read_full = strong signal (3pt), view = weak signal (1pt)
      const basePoints = row.action_type === 'read_full' ? 3 : 1;
      // Phase 3: same user reading = 2× multiplier (personalisation)
      const multiplier = userId && row.user_id === userId ? 2 : 1;
      scores.set(row.article_url, prev + basePoints * multiplier);
    }

    return scores;
  } catch {
    return new Map();
  }
}

/**
 * Efraimidis-Spirakis weighted shuffle.
 * Each item gets key = random^(1/weight) — higher weight → key stays near 1.
 * Sorting descending by key gives a weighted random ordering where every
 * article has a chance to appear anywhere, but heavier ones trend to the top.
 */
export function weightedShuffle<T extends { sourceUrl: string; likes?: number }>(
  items: T[],
  weights: Map<string, number>
): T[] {
  return [...items]
    .map(item => {
      const reads = weights.get(item.sourceUrl) ?? 0;
      const likes = item.likes ?? 0;
      const raw = reads + likes * 5; // likes are explicit engagement — worth more
      const w = Math.log(1 + raw) + 1; // +1 ensures min weight=1 for unseen articles
      return { item, key: Math.random() ** (1 / w) };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

export function spotifyShuffle(articles: NewsItem[]): NewsItem[] {
  if (articles.length <= 1) return articles;

  // Fisher-Yates with Math.random() — genuinely different every single call
  const arr = [...articles];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // Spread articles from the same source evenly (round-robin by source)
  const groups: Record<string, NewsItem[]> = {};
  for (const a of arr) {
    if (!groups[a.source]) groups[a.source] = [];
    groups[a.source].push(a);
  }

  // Shuffle the source order too so it's not always the same outlet first
  const sourceKeys = Object.keys(groups);
  for (let i = sourceKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sourceKeys[i], sourceKeys[j]] = [sourceKeys[j], sourceKeys[i]];
  }

  // Round-robin interleave across sources
  const result: NewsItem[] = [];
  let round = 0;
  while (result.length < arr.length) {
    const key = sourceKeys[round % sourceKeys.length];
    const group = groups[key];
    if (group && group.length > 0) result.push(group.shift()!);
    round++;
  }

  return result;
}

/**
 * Get all cached articles (with pagination support)
 */
export async function getAllCachedArticles(offset = 0, limit = 50): Promise<NewsItem[]> {
  try {
    const { data, error } = await supabase
      .from('cached_articles')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('article_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching all cached articles:', error);
      return [];
    }

    // We don't shuffle here anymore to maintain a consistent timeline across pages
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
