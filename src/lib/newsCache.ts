/**
 * News Cache Service
 * Handles caching of processed articles in Supabase
 * - Fetches from cache first (instant loading)
 * - Only processes new/expired articles with AI
 * - Articles are permanent and never expire.
 */

import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/data/mockNews";
import { getFeedTrackingId } from "@/lib/feedTracking";
import { interleaveVideoCards } from "@/lib/feedCadence";

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
  game_tags: string[];
  likes: number;
  article_date: string;
  fetched_at: string;
  expires_at: string;
  media_type?: "article" | "youtube";
  video_id?: string | null;
  rank_score?: number | string;
  rank_reason?: NewsItem["rankReason"];
}

// News is permanent; expiry is set to a far-future date.
const PERMANENT_EXPIRES_AT = '2099-12-31T23:59:59.000Z';
const PRIORITY_NEWS_SOURCES = ["Game Developer", "Dexerto Twitch", "Dexerto"];

/**
 * Convert NewsItem to database format
 */
function toDbFormat(article: NewsItem): Omit<CachedArticle, 'id' | 'fetched_at'> {
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
    expires_at: PERMANENT_EXPIRES_AT,
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
    imageUrl: article.og_image_url || article.image_url || "",
    category: article.category,
    timestamp: article.article_date,
    source: article.source,
    author: article.author,
    tags: article.tags,
    gameTags: article.game_tags || [],
    likes: article.likes,
    fetchedAt: article.fetched_at,
    mediaType: article.media_type || "article",
    videoId: article.video_id || undefined,
    rankScore: Number(article.rank_score) || 0,
    rankReason: article.rank_reason,
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
      .in('source_url', urls);

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

  const dbArticles = articles.map(article => toDbFormat(article));

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
 * Deterministic source spreading for normal feed loads. Articles remain newest
 * first within each publisher, while round-robin selection prevents a
 * high-volume outlet from filling the entire first page.
 */
function spreadRecentArticlesBySource(articles: NewsItem[]): NewsItem[] {
  const groups = new Map<string, NewsItem[]>();
  for (const article of articles) {
    const group = groups.get(article.source) ?? [];
    group.push(article);
    groups.set(article.source, group);
  }

  const sourceOrder = [...groups.keys()].sort((a, b) => {
    const aPriority = PRIORITY_NEWS_SOURCES.indexOf(a);
    const bPriority = PRIORITY_NEWS_SOURCES.indexOf(b);
    if (aPriority !== -1 || bPriority !== -1) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }
    const aDate = new Date(groups.get(a)![0].timestamp).getTime();
    const bDate = new Date(groups.get(b)![0].timestamp).getTime();
    return bDate - aDate || a.localeCompare(b);
  });

  const result: NewsItem[] = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const source of sourceOrder) {
      const article = groups.get(source)?.[round];
      if (article) {
        result.push(article);
        added = true;
      }
    }
    if (!added) return result;
  }
}

/**
 * Tag frequency across all cached articles.
 * Powers the real "Browse by category" counts — each count is the number
 * of articles actually tagged with that entity. An article counts once per
 * distinct tag (tags + game_tags merged & de-duped).
 */
export interface TrendingTag { tag: string; count: number; }

const CATEGORY_JUNK = new Set([
  "gaming", "news", "game", "games", "update", "updates", "entertainment",
  "review", "preview", "trailer", "rumor", "leak", "gameplay",
]);

export async function getTrendingTags(limit = 12): Promise<TrendingTag[]> {
  try {
    const { data, error } = await supabase
      .from('cached_articles')
      .select('tags, game_tags');

    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      const seen = new Set<string>();
      for (const t of [...(row.tags ?? []), ...(row.game_tags ?? [])]) {
        if (typeof t === 'string' && t.trim().length > 1) seen.add(t.trim());
      }
      for (const t of seen) counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    return [...counts.entries()]
      .filter(([tag]) => !CATEGORY_JUNK.has(tag.toLowerCase()))
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get all cached articles (with pagination support)
 */
export async function getAllCachedArticles(
  offset = 0,
  limit = 50,
  category?: string,
  tag?: string,
): Promise<NewsItem[]> {
  // Retry up to 3 times — Supabase auth init can abort in-flight queries
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // A paused news pipeline should look paused too. The normal ranking RPC
      // intentionally rotates cards every 15 minutes and after impressions;
      // bypass it during a hard freeze and return one stable newest-first view.
      const { data: newsControl } = await supabase
        .from('operational_controls')
        .select('enabled')
        .eq('key', 'news_updates')
        .maybeSingle();

      if (newsControl?.enabled === false) {
        let frozenQuery = supabase
          .from('cached_articles')
          .select('*')
          .order('article_date', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + limit - 1);

        if (category) frozenQuery = frozenQuery.eq('category', category);
        const frozenTag = tag?.replace(/[^a-zA-Z0-9]/g, '');
        if (frozenTag) {
          frozenQuery = frozenQuery.or(`tags.cs.{${frozenTag}},game_tags.cs.{${frozenTag}}`);
        }

        const { data: frozenRows, error: frozenError } = await frozenQuery;
        if (frozenError) {
          console.warn('Frozen news feed unavailable:', frozenError.message);
          return [];
        }
        return ((frozenRows ?? []) as CachedArticle[]).map(toNewsItem);
      }

      const useVideoCadence =
        !tag
        && limit >= 5
        && (!category || category.toLowerCase() === "gaming");
      const videoSlots = useVideoCadence ? Math.floor(limit / 5) : 0;
      const articleSlots = limit - videoSlots;
      const pageIndex = Math.floor(offset / limit);
      const rankedOffset = useVideoCadence ? pageIndex * articleSlots : offset;

      const { data: rankedData, error: rankedError } = await supabase.rpc("get_ranked_feed", {
        p_tracking_id: getFeedTrackingId(),
        p_offset: rankedOffset,
        p_limit: limit,
        p_category: category ?? null,
        p_tag: tag ?? null,
      });

      if (!rankedError) {
        let rankedItems = ((rankedData ?? []) as CachedArticle[]).map(toNewsItem);

        // The first feed page must always expose genuinely fresh reporting.
        // Personalization and impression rotation still rank the rest, but
        // they cannot bury every new story below cards the reader has seen.
        if (offset === 0 && !tag) {
          const freshnessCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          let latestQuery = supabase
            .from("cached_articles")
            .select("*")
            .eq("duplicate_flag", false)
            .lt("report_count", 3)
            .gte("article_date", freshnessCutoff)
            .order("article_date", { ascending: false })
            .limit(6);
          if (category) latestQuery = latestQuery.eq("category", category);

          const { data: latestRows, error: latestError } = await latestQuery;
          if (!latestError && latestRows?.length) {
            const latest = (latestRows as CachedArticle[]).map(toNewsItem);
            const latestUrls = new Set(latest.map((item) => item.sourceUrl));
            rankedItems = [...latest, ...rankedItems.filter((item) => !latestUrls.has(item.sourceUrl))];
          }
        }

        if (!useVideoCadence || videoSlots === 0) return rankedItems.slice(0, limit);

        const videoOffset = pageIndex * videoSlots;
        const freshnessCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        const { data: videoRows, error: videoError } = await supabase
          .from("cached_articles")
          .select("*")
          .eq("category", category ?? "Gaming")
          .eq("media_type", "youtube")
          .eq("duplicate_flag", false)
          .lt("report_count", 3)
          .gte("article_date", freshnessCutoff)
          .order("article_date", { ascending: false })
          .range(videoOffset, videoOffset + videoSlots - 1);

        if (videoError) {
          console.warn("YouTube cadence query unavailable:", videoError.message);
          return rankedItems.slice(0, limit);
        }

        const rankedVideos = rankedItems.filter((item) => item.mediaType === "youtube");
        const selectedVideos = [
          ...rankedVideos,
          ...((videoRows ?? []) as CachedArticle[]).map(toNewsItem),
        ].slice(0, videoSlots);

        return interleaveVideoCards(
          rankedItems,
          selectedVideos,
          4,
          limit,
        );
      }
      console.warn("Ranked feed unavailable, using recency fallback:", rankedError.message);

      // Balance within a stable 100-row window so each page contains a mix of
      // publishers without random pagination duplicates.
      const windowSize = Math.max(100, limit);
      const windowStart = Math.floor(offset / windowSize) * windowSize;
      let query = supabase
        .from('cached_articles')
        .select('*')
        .order('article_date', { ascending: false })
        .range(windowStart, windowStart + windowSize - 1);

      if (category) {
        query = query.eq('category', category);
      }
      const safeTag = tag?.replace(/[^a-zA-Z0-9]/g, '');
      if (safeTag) {
        query = query.or(`tags.cs.{${safeTag}},game_tags.cs.{${safeTag}}`);
      }

      const { data, error } = await query;

      if (error) {
        const isAbort = error.message?.includes('AbortError') || error.details?.includes?.('AbortError');
        if (isAbort && attempt < 2) {
          await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        console.error('Error fetching all cached articles:', error);
        return [];
      }

      let feedRows = data || [];
      if (windowStart === 0 && !safeTag) {
        const priorityResults = await Promise.all(PRIORITY_NEWS_SOURCES.map(async (source) => {
          let priorityQuery = supabase
            .from('cached_articles')
            .select('*')
            .eq('source', source)
            .order('article_date', { ascending: false })
            .limit(1);
          if (category) priorityQuery = priorityQuery.eq('category', category);
          const { data: priorityData } = await priorityQuery;
          return priorityData?.[0] ?? null;
        }));
        const priorityRows = priorityResults.filter((row): row is NonNullable<typeof row> => row !== null);
        const priorityUrls = new Set(priorityRows.map((row) => row.source_url));
        feedRows = [...priorityRows, ...feedRows.filter((row) => !priorityUrls.has(row.source_url))];
      }

      const balanced = spreadRecentArticlesBySource(feedRows.map(toNewsItem));
      const startInWindow = offset - windowStart;
      return balanced.slice(startInWindow, startInWindow + limit);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort && attempt < 2) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      console.error('Get all cached error:', err);
      return [];
    }
  }
  return [];
}

/**
 * Clean up expired articles
 * News is permanent; this is now a no-op for cached_articles.
 */
export async function cleanupExpiredArticles(): Promise<void> {
  // Articles no longer expire. Keeping this function preserves backwards
  // compatibility for any callers.
}

/**
 * Check if cache needs refresh.
 * Returns true when the cache is below the minimum floor (e.g. after a
 * clean slate or failed ingestion runs).
 */
const MINIMUM_ARTICLE_FLOOR = 10;

export async function shouldRefreshCache(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('cached_articles')
      .select('*', { count: 'exact', head: true });

    if (error) return true;
    return (count ?? 0) < MINIMUM_ARTICLE_FLOOR;
  } catch {
    return true;
  }
}

/**
 * Get the current number of cached articles (for cache-floor guard).
 */
export async function getCachedArticleCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('cached_articles')
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.error('Error counting cached articles:', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('Count cached articles error:', err);
    return 0;
  }
}
