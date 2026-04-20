/**
 * useGamingNews
 *
 * All RSS fetching, full-article scraping (Jina AI), and AI processing (Groq)
 * happens server-side in the `fetch-news` Supabase Edge Function.
 *
 * This hook's only job is:
 *   1. Read processed articles from Supabase (instant)
 *   2. Trigger `fetch-news` when the cache is stale or empty
 *   3. Expose a manual refresh
 */

import { useState, useEffect, useCallback } from "react";
import { INITIAL_NEWS, NewsItem } from "@/data/mockNews";
import { supabase } from "@/integrations/supabase/client";
import { getAllCachedArticles, shouldRefreshCache, spotifyShuffle } from "@/lib/newsCache";

export function useGamingNews() {
  const [news, setNews]               = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore]         = useState(true);
  const [page, setPage]               = useState(0);

  const PAGE_SIZE = 20;

  // ── Read from DB ──────────────────────────────────────────────────────────
  const loadFromDB = useCallback(async (isInitial = true): Promise<number> => {
    try {
      const currentOffset = isInitial ? 0 : (page + 1) * PAGE_SIZE;
      const articles = await getAllCachedArticles(currentOffset, PAGE_SIZE);
      
      if (articles.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (articles.length > 0) {
        setNews(prev => {
          if (isInitial) return articles;
          // Avoid duplicates by checking sourceUrl
          const existingUrls = new Set(prev.map(a => a.sourceUrl));
          const uniqueNew = articles.filter(a => !existingUrls.has(a.sourceUrl));
          return [...prev, ...uniqueNew];
        });
        
        if (isInitial) {
          setPage(0);
          setHasMore(articles.length === PAGE_SIZE);
        } else {
          setPage(p => p + 1);
        }
        
        setLastUpdated(new Date());
      } else if (!isInitial) {
        setHasMore(false);
      }
      return articles.length;
    } catch (err) {
      console.error("loadFromDB error:", err);
      return 0;
    }
  }, [page]);

  // ── Load more (exposed to UI) ─────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      await loadFromDB(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, loadFromDB]);

  // ── Trigger server-side pipeline then reload ──────────────────────────────
  const triggerFetch = useCallback(async () => {
    console.log("Invoking fetch-news edge function…");
    try {
      const { error: fnErr } = await supabase.functions.invoke("fetch-news");
      if (fnErr) console.error("fetch-news error:", fnErr);
    } catch (err) {
      console.error("fetch-news invoke error:", err);
    }
    await loadFromDB(true);
  }, [loadFromDB]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);

      // Always show whatever is cached immediately
      const count = await loadFromDB();

      if (cancelled) return;

      if (count === 0) {
        // Empty — trigger server fetch and wait for results
        await triggerFetch();
        // If still empty after fetch (function failed), show fallback
        const afterFetch = await loadFromDB();
        if (afterFetch === 0) {
          console.warn("Cache still empty after fetch, using fallback data");
          setNews(INITIAL_NEWS);
        }
      } else {
        setIsLoading(false);
        // Cache exists — check if stale and refresh in background
        const stale = await shouldRefreshCache();
        if (!cancelled && stale) {
          triggerFetch(); // fire and forget
        }
      }

      if (!cancelled) setIsLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Instant reshuffle (no DB hit) ─────────────────────────────────────────
  const reshuffle = useCallback(() => {
    setNews(prev => spotifyShuffle(prev));
  }, []);

  // ── Manual refresh (exposed to UI) ────────────────────────────────────────
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await triggerFetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [triggerFetch]);

  return {
    news,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    isUsingFallback: false,
    lastUpdated,
    hasMore,
    refresh,
    loadMore,
    reshuffle,
  };
}
