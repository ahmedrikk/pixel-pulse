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

import { useState, useEffect, useCallback, useRef } from "react";
import { NewsItem } from "@/data/mockNews";
import { supabase } from "@/integrations/supabase/client";
import { getAllCachedArticles, shouldRefreshCache, spotifyShuffle } from "@/lib/newsCache";
import { useAuthGate } from "@/contexts/AuthGateContext";

export function useGamingNews(options?: { category?: string }) {
  const category = options?.category;
  const { isLoading: isAuthLoading } = useAuthGate();
  const [news, setNews]               = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore]         = useState(true);
  const [page, setPage]               = useState(0);

  const PAGE_SIZE = 20;

  // Mirror of news.length so loadFromDB can tell a cold start from a
  // background refresh without adding `news` to its deps.
  const newsCountRef = useRef(0);
  useEffect(() => { newsCountRef.current = news.length; }, [news]);

  // ── Read from DB ──────────────────────────────────────────────────────────
  const loadFromDB = useCallback(async (isInitial = true): Promise<number> => {
    try {
      const currentOffset = isInitial ? 0 : (page + 1) * PAGE_SIZE;
      const articles = await getAllCachedArticles(currentOffset, PAGE_SIZE, category);
      const wasEmpty = newsCountRef.current === 0;

      if (articles.length > 0) {
        setNews(prev => {
          if (prev.length === 0) return articles;
          // Merge — never replace a list the user is already reading.
          // New articles from a background refresh go to the front;
          // paginated (older) articles go to the back.
          const existingUrls = new Set(prev.map(a => a.sourceUrl));
          const uniqueNew = articles.filter(a => !existingUrls.has(a.sourceUrl));
          return isInitial ? [...uniqueNew, ...prev] : [...prev, ...uniqueNew];
        });

        if (isInitial && wasEmpty) {
          setPage(0);
          setHasMore(articles.length === PAGE_SIZE);
        } else if (!isInitial) {
          setPage(p => p + 1);
          if (articles.length < PAGE_SIZE) setHasMore(false);
        }

        setLastUpdated(new Date());
      } else if (!isInitial) {
        setHasMore(false);
      } else if (wasEmpty) {
        setHasMore(false);
      }
      return articles.length;
    } catch (err) {
      console.error("loadFromDB error:", err);
      return 0;
    }
  }, [page, category]);

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
  const triggerFetch = useCallback(async (timeoutMs = 60000) => {
    console.log("Invoking fetch-news edge function…");
    try {
      const result = await Promise.race([
        supabase.functions.invoke("fetch-news"),
        new Promise<{ timedOut: true }>((resolve) =>
          setTimeout(() => resolve({ timedOut: true }), timeoutMs)
        ),
      ]);
      if ("timedOut" in result) {
        console.warn(`fetch-news timed out after ${timeoutMs}ms`);
      } else if (result.error) {
        console.error("fetch-news error:", result.error);
      }
    } catch (err) {
      console.error("fetch-news invoke error:", err);
    }
    await loadFromDB(true);
  }, [loadFromDB]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Wait until Supabase auth finishes initializing before fetching.
    // During auth init, token refresh aborts all in-flight DB requests.
    if (isAuthLoading) return;

    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);

      // Always show whatever is cached immediately
      const count = await loadFromDB();

      if (cancelled) return;

      if (count === 0) {
        // Empty — try to fetch fresh articles instead of showing stale mock data.
        console.warn("Cache empty — fetching fresh articles…");
        await triggerFetch(60000);
        if (!cancelled) setIsLoading(false);
      } else {
        setIsLoading(false);
        // Cache exists — check if stale and refresh in background
        const stale = await shouldRefreshCache();
        if (!cancelled && stale) {
          triggerFetch(); // fire and forget
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [isAuthLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
