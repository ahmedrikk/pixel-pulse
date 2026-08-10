/**
 * useGamingNews
 *
 * All RSS/YouTube fetching, article scraping, and Gemini-first AI processing
 * happens server-side in the `fetch-news` Supabase Edge Function.
 *
 * This hook's only job is:
 *   1. Read processed articles from Supabase instantly (cache-first)
 *   2. Trigger `fetch-news` only when the cache floor is too low
 *   3. Refresh in the background without blocking the UI
 *   4. Expose a manual refresh
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { NewsItem } from "@/data/mockNews";
import { supabase } from "@/integrations/supabase/client";
import { getAllCachedArticles, getCachedArticleCount, spotifyShuffle } from "@/lib/newsCache";

const MINIMUM_ARTICLE_FLOOR = 10;

export function useGamingNews(options?: { category?: string; tag?: string }) {
  const category = options?.category;
  const tag = options?.tag;
  const [news, setNews]               = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasMore, setHasMore]         = useState(true);
  const pageRef = useRef(0);

  const PAGE_SIZE = tag ? 10 : 20;

  // Mirror of news.length so loadFromDB can tell a cold start from a
  // background refresh without adding `news` to its deps.
  const newsCountRef = useRef(0);
  useEffect(() => { newsCountRef.current = news.length; }, [news]);

  // ── Read from DB ──────────────────────────────────────────────────────────
  const loadFromDB = useCallback(async (
    isInitial = true,
    replaceExisting = false,
  ): Promise<number> => {
    try {
      const nextPage = isInitial ? 0 : pageRef.current + 1;
      const currentOffset = nextPage * PAGE_SIZE;
      const articles = await getAllCachedArticles(currentOffset, PAGE_SIZE, category, tag);
      const wasEmpty = newsCountRef.current === 0;

      if (articles.length > 0) {
        setNews(prev => {
          if (prev.length === 0 || replaceExisting) return articles;
          // Merge — never replace a list the user is already reading.
          // New articles from a background refresh go to the front;
          // paginated (older) articles go to the back.
          const existingUrls = new Set(prev.map(a => a.sourceUrl));
          const uniqueNew = articles.filter(a => !existingUrls.has(a.sourceUrl));
          return isInitial ? [...uniqueNew, ...prev] : [...prev, ...uniqueNew];
        });

        if (isInitial && wasEmpty) {
          pageRef.current = 0;
          setHasMore(articles.length === PAGE_SIZE);
        } else if (!isInitial) {
          pageRef.current = nextPage;
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
  }, [category, tag, PAGE_SIZE]);

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
  const triggerFetch = useCallback(async (timeoutMs = 120000) => {
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

  // ── Cache-floor guard: if we ever drop below the floor, fetch immediately ──
  const enforceCacheFloor = useCallback(async () => {
    const count = await getCachedArticleCount();
    if (count < MINIMUM_ARTICLE_FLOOR) {
      console.warn(`Cache floor breached (${count} articles) — fetching immediately…`);
      await triggerFetch(120000);
    }
  }, [triggerFetch]);

  // ── Initial load ──────────────────────────────────────────────────────────
  // Do NOT wait for auth initialization. The public feed can be read
  // anonymously, and Supabase aborts during auth init can delay first paint.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      newsCountRef.current = 0;
      pageRef.current = 0;
      setNews([]);
      setHasMore(true);
      setIsLoading(true);
      setError(null);

      // Always show whatever is cached immediately
      await loadFromDB();
      if (!cancelled) setIsLoading(false);

      // Cache-floor guard: if the cache is critically low, fetch in background
      // without re-entering the loading state.
      const count = await getCachedArticleCount();
      if (!cancelled && count < MINIMUM_ARTICLE_FLOOR) {
        setIsRefreshing(true);
        try {
          await triggerFetch(120000);
        } finally {
          if (!cancelled) setIsRefreshing(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [loadFromDB, triggerFetch, category, tag]);

  // ── Instant reshuffle (no DB hit) ─────────────────────────────────────────
  const reshuffle = useCallback(() => {
    setNews(prev => spotifyShuffle(prev));
  }, []);

  // ── Manual refresh (exposed to UI) ────────────────────────────────────────
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      // Refresh the ranked view immediately. Ingestion runs independently on
      // its cron, so a user refresh never spends AI tokens. Shuffle after the
      // cache reload so the newest-story injection cannot pin card one.
      await loadFromDB(true, true);
      setNews(current => spotifyShuffle(current));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadFromDB]);

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
