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
import { NewsItem } from "@/data/mockNews";
import { supabase } from "@/integrations/supabase/client";
import { getAllCachedArticles, shouldRefreshCache } from "@/lib/newsCache";

export function useGamingNews() {
  const [news, setNews]               = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Read from DB ──────────────────────────────────────────────────────────
  const loadFromDB = useCallback(async (): Promise<number> => {
    try {
      const articles = await getAllCachedArticles();
      if (articles.length > 0) {
        setNews(articles);
        setLastUpdated(new Date());
      }
      return articles.length;
    } catch (err) {
      console.error("loadFromDB error:", err);
      return 0;
    }
  }, []);

  // ── Trigger server-side pipeline then reload ──────────────────────────────
  const triggerFetch = useCallback(async () => {
    console.log("Invoking fetch-news edge function…");
    try {
      const { error: fnErr } = await supabase.functions.invoke("fetch-news");
      if (fnErr) console.error("fetch-news error:", fnErr);
    } catch (err) {
      console.error("fetch-news invoke error:", err);
    }
    await loadFromDB();
  }, [loadFromDB]);

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

  return {
    news,
    isLoading,
    isRefreshing,
    error,
    isUsingFallback: false,
    lastUpdated,
    refresh,
  };
}
