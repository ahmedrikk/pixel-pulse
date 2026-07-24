import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_trending_topics", {
      p_limit: limit,
    });
    if (error) {
      console.error("Unable to load trending topics:", error);
      setIsLoading(false);
      return;
    }
    setTopics(((data ?? []) as TrendingTopicRow[]).map((row) => ({
      tag: row.tag,
      articleCount: Number(row.article_count) || 0,
      upvotes: Number(row.upvotes) || 0,
      downvotes: Number(row.downvotes) || 0,
      comments: Number(row.comments) || 0,
      shares: Number(row.shares) || 0,
      trendScore: Number(row.trend_score) || 0,
    })));
    setIsLoading(false);
  }, [limit]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return { topics, isLoading, refresh: load };
}

