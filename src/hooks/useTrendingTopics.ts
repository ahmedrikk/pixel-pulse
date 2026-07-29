import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TRENDING_CACHE_KEY = "talus:trending-topics:v2";

function millisecondsUntilNextWindow(): number {
  const now = new Date();
  const next = new Date(now);
  if (now.getUTCHours() < 12) {
    next.setUTCHours(12, 0, 5, 0);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 5, 0);
  }
  return Math.max(60_000, next.getTime() - now.getTime());
}

export interface TrendingTopic {
  tag: string;
  articleCount: number;
  upvotes: number;
  downvotes: number;
  comments: number;
  shares: number;
  trendScore: number;
}

interface TrendingTopicRow {
  tag: string;
  article_count: number | string;
  upvotes: number | string;
  downvotes: number | string;
  comments: number | string;
  shares: number | string;
  trend_score: number | string;
}

export function useTrendingTopics(limit = 5) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (showCached = true) => {
    if (showCached) {
      try {
        const cached = JSON.parse(localStorage.getItem(TRENDING_CACHE_KEY) ?? "null") as {
          savedAt?: number;
          topics?: TrendingTopic[];
        } | null;
        const cachedTopics = cached?.topics;
        if (
          Array.isArray(cachedTopics)
          && cachedTopics.length > 0
        ) {
          setTopics(cachedTopics.slice(0, limit));
          setIsLoading(false);
        }
      } catch {
        localStorage.removeItem(TRENDING_CACHE_KEY);
      }
    }

    // The cached list is paint-only. Always ask the server for the active
    // 12-hour window so an old browser cache can never freeze Trending.
    const { data, error } = await supabase.rpc("get_trending_topics", {
      p_limit: limit,
    });
    if (error) {
      console.error("Unable to load trending topics:", error);
      setIsLoading(false);
      return;
    }
    const nextTopics = ((data ?? []) as TrendingTopicRow[]).map((row) => ({
      tag: row.tag,
      articleCount: Number(row.article_count) || 0,
      upvotes: Number(row.upvotes) || 0,
      downvotes: Number(row.downvotes) || 0,
      comments: Number(row.comments) || 0,
      shares: Number(row.shares) || 0,
      trendScore: Number(row.trend_score) || 0,
    }));
    setTopics(nextTopics);
    localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      topics: nextTopics,
    }));
    setIsLoading(false);
  }, [limit]);

  useEffect(() => {
    load();
    let timer: number | undefined;
    const scheduleNextWindow = () => {
      timer = window.setTimeout(async () => {
        await load(false);
        scheduleNextWindow();
      }, millisecondsUntilNextWindow());
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    scheduleNextWindow();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load]);

  return { topics, isLoading, refresh: () => load(false) };
}
