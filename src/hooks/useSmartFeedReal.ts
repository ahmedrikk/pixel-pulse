import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useGamingNews } from "./useGamingNews";
import type { NewsItem } from "@/data/mockNews";
import type { Article, RankedArticle, UserImpression } from "@/types/feed";
import { recordArticleDwell, recordFeedEngagement } from "@/lib/feedTracking";

function convertToArticle(news: NewsItem): RankedArticle {
  return {
    id: news.id,
    title: news.title,
    summary: news.summary,
    summaryWordCount: news.summary.split(/\s+/).filter(Boolean).length,
    sourceName: news.source,
    sourceUrl: news.sourceUrl,
    author: news.author,
    heroImageUrl: news.imageUrl,
    gameTags: news.gameTags || [],
    topicTags: news.tags || [],
    publishedAt: news.timestamp,
    fetchedAt: news.fetchedAt || new Date().toISOString(),
    engagementScore: news.rankScore || 0,
    likes: news.likes || 0,
    comments: news.comments || 0,
    reactions: {},
    mediaType: news.mediaType || "article",
    videoId: news.videoId,
    priority: news.rankReason || "unseen",
    priorityScore: news.rankScore || 0,
  };
}
interface UseSmartFeedOptions {
  userId?: string;
  pageSize?: number;
  tag?: string;
}

export function useSmartFeedReal(options: UseSmartFeedOptions = {}) {
  const { tag } = options;
  const {
    news,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    refresh,
    loadMore: loadMoreNews,
    hasMore: hasMoreNews,
  } = useGamingNews({ category: "Gaming", tag });

  const articles = useMemo(() => news.map(convertToArticle), [news]);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [seenArticleIds, setSeenArticleIds] = useState<Set<string>>(new Set());
  const lastLoadTimeRef = useRef(new Date());

  useEffect(() => {
    setSeenArticleIds(new Set());
  }, [tag]);

  const trackImpression = useCallback(async (
    articleId: string,
    dwellSeconds: number,
    readFull = false,
  ) => {
    const impression: UserImpression = {
      id: `imp-${Date.now()}`,
      userId: options.userId || "guest",
      articleId,
      seenAt: new Date().toISOString(),
      readFull,
      dwellSeconds,
    };
    void impression;
    setSeenArticleIds((previous) => new Set(previous).add(articleId));
    try {
      if (dwellSeconds >= 1) await recordArticleDwell(articleId, dwellSeconds);
      if (readFull) await recordFeedEngagement(articleId, "read_full");
    } catch (trackingError) {
      console.error("Failed to record feed interaction:", trackingError);
    }
  }, [options.userId]);

  const checkForNewArticles = useCallback(async () => {
    await refresh();
    const count = articles.filter(
      (article) => new Date(article.publishedAt) > lastLoadTimeRef.current,
    ).length;
    setNewArticlesCount(count);
    if (count > 0) toast.success(`${count} new article${count === 1 ? "" : "s"} available`);
    else toast.info("You're all caught up!");
    lastLoadTimeRef.current = new Date();
  }, [articles, refresh]);

  const dismissNewBadge = useCallback(() => setNewArticlesCount(0), []);
  const loadMore = useCallback(async () => {
    if (hasMoreNews) await loadMoreNews();
  }, [hasMoreNews, loadMoreNews]);

  const feedStats = useMemo(() => ({
    total: articles.length,
    personalized: articles.filter((article) => article.priority === "personalized").length,
    unseen: articles.filter((article) => article.priority === "unseen").length,
    trending: articles.filter((article) => article.priority === "trending").length,
  }), [articles]);

  return {
    articles,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore: hasMoreNews,
    newArticlesCount,
    feedStats,
    loadFeed: refresh,
    loadMore,
    checkForNewArticles,
    dismissNewBadge,
    trackImpression,
    reshuffle: refresh,
    seenCount: seenArticleIds.size,
  };
}
