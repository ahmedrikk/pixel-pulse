import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useGamingNews } from "./useGamingNews";
import { supabase } from "@/integrations/supabase/client";
import { Article, RankedArticle, FeedPriority, UserImpression, FeedSession } from "@/types/feed";
import { toast } from "sonner";

// Convert NewsItem to Article format
function convertToArticle(news: {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  imageUrl: string;
  category: string;
  timestamp: string;
  source: string;
  author: string;
  tags: string[];
  likes?: number;
  comments?: number;
}): Article {
  return {
    id: news.id,
    title: news.title,
    summary: news.summary,
    summaryWordCount: news.summary.split(" ").length,
    sourceName: news.source,
    sourceUrl: news.sourceUrl,
    author: news.author,
    heroImageUrl: news.imageUrl,
    gameTags: news.tags.filter(t => ["PlayStation", "Xbox", "PCGaming", "Nintendo", "FPS", "RPG", "Indie", "Esports"].includes(t)),
    topicTags: news.tags,
    publishedAt: news.timestamp,
    fetchedAt: new Date().toISOString(),
    engagementScore: (news.likes || 0) + ((news.comments || 0) * 2),
    likes: news.likes || 0,
    comments: news.comments || 0,
    reactions: {},
  };
}

interface UseSmartFeedOptions {
  userId?: string;
  pageSize?: number;
}

export function useSmartFeedReal(options: UseSmartFeedOptions = {}) {
  const { userId, pageSize = 15 } = options;
  
  // Use the existing gaming news hook for RSS feed data
  const { 
    news, 
    isLoading, 
    isRefreshing, 
    error, 
    refresh 
  } = useGamingNews();
  
  const [articles, setArticles] = useState<RankedArticle[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [userFavGames, setUserFavGames] = useState<string[]>([]);
  const [seenArticleIds, setSeenArticleIds] = useState<Set<string>>(new Set());
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  
  const impressionsRef = useRef<Map<string, UserImpression>>(new Map());
  const lastLoadTimeRef = useRef<Date>(new Date());
  const initialLoadComplete = useRef(false);

  // Convert news to articles
  const allArticles = useMemo(() => {
    return news.map(convertToArticle);
  }, [news]);

  // Fetch user preferences (favorite games)
  const fetchUserPreferences = useCallback(async () => {
    if (!userId) {
      setIsLoadingPrefs(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_games")
        .select("game_name")
        .eq("user_id", userId)
        .eq("is_favorite", true);

      if (error) throw error;

      const favGames = data?.map(g => g.game_name) || [];
      setUserFavGames(favGames);
    } catch (err) {
      console.error("Failed to fetch user preferences:", err);
    } finally {
      setIsLoadingPrefs(false);
    }
  }, [userId]);

  // Fetch user's seen articles from Supabase
  const fetchUserImpressions = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("article_reads")
        .select("article_url")
        .eq("user_id", userId)
        .gte("read_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const seenIds = new Set(data?.map(r => r.article_url) || []);
      setSeenArticleIds(seenIds);
    } catch (err) {
      console.error("Failed to fetch impressions:", err);
    }
  }, [userId]);

  // Calculate priority score for ranking
  const calculatePriority = useCallback((article: Article): { priority: FeedPriority; score: number } => {
    const isSeen = seenArticleIds.has(article.sourceUrl);
    const isFavGameMatch = userFavGames.some(game => 
      article.gameTags.some(tag => tag.toLowerCase().includes(game.toLowerCase()))
    );
    
    // Priority 1: Personalized (fav game match + unseen)
    if (isFavGameMatch && !isSeen) {
      return { priority: "personalized", score: 100 + article.engagementScore };
    }
    
    // Priority 2: Unseen articles by recency
    if (!isSeen) {
      const hoursOld = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
      return { priority: "unseen", score: 80 - Math.min(hoursOld * 2, 40) };
    }
    
    // Priority 3: Trending (high engagement, seen but recent)
    const hoursOld = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 24 && article.engagementScore > 100) {
      return { priority: "trending", score: 50 + article.engagementScore / 10 };
    }
    
    // Priority 4: Fallback (seen, older articles)
    return { priority: "fallback", score: 10 };
  }, [userFavGames, seenArticleIds]);

  // Rank and sort articles
  const rankArticles = useCallback((articlesToRank: Article[]): RankedArticle[] => {
    const ranked = articlesToRank.map(article => {
      const { priority, score } = calculatePriority(article);
      return { ...article, priority, priorityScore: score };
    });
    
    return ranked.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [calculatePriority]);

  // Load and rank articles when news changes
  useEffect(() => {
    if (news.length === 0) return;
    
    const ranked = rankArticles(allArticles);
    setArticles(ranked);
    setHasMore(ranked.length > pageSize);
    initialLoadComplete.current = true;
    lastLoadTimeRef.current = new Date();
  }, [news, allArticles, rankArticles, pageSize]);

  // Load user data on mount
  useEffect(() => {
    fetchUserPreferences();
    fetchUserImpressions();
  }, [fetchUserPreferences, fetchUserImpressions]);

  // Track impression
  const trackImpression = useCallback(async (articleId: string, dwellSeconds: number, readFull: boolean = false) => {
    if (!userId) return;

    try {
      const impression: UserImpression = {
        id: `imp-${Date.now()}`,
        userId,
        articleId,
        seenAt: new Date().toISOString(),
        readFull,
        dwellSeconds,
      };

      impressionsRef.current.set(articleId, impression);

      // Save to Supabase
      await supabase.from("article_reads").upsert({
        user_id: userId,
        article_url: articleId,
        action_type: readFull ? "read_full" : "viewed",
        read_date: new Date().toISOString(),
      });

      // Update local seen set
      setSeenArticleIds(prev => new Set([...prev, articleId]));
    } catch (err) {
      console.error("Failed to track impression:", err);
    }
  }, [userId]);

  // Check for new articles
  const checkForNewArticles = useCallback(async () => {
    await refresh();
    
    // Find articles published after last load
    const newArticles = allArticles.filter(article => {
      const pubDate = new Date(article.publishedAt);
      return pubDate > lastLoadTimeRef.current && !seenArticleIds.has(article.sourceUrl);
    });

    if (newArticles.length > 0) {
      setNewArticlesCount(newArticles.length);
      toast.success(`${newArticles.length} new articles available`, {
        action: {
          label: "View",
          onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
        },
      });
    } else {
      toast.info("You're all caught up!");
    }

    lastLoadTimeRef.current = new Date();
  }, [refresh, allArticles, seenArticleIds]);

  // Dismiss new badge
  const dismissNewBadge = useCallback(() => {
    setNewArticlesCount(0);
    setArticles(prev => prev.map(a => ({ ...a, isNew: false })));
  }, []);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    // In a real implementation, this would fetch the next page
    // For now, just show all articles
    setHasMore(false);
  }, []);

  // Get feed stats
  const feedStats = useMemo(() => {
    const total = articles.length;
    const personalized = articles.filter(a => a.priority === "personalized").length;
    const unseen = articles.filter(a => a.priority === "unseen").length;
    const trending = articles.filter(a => a.priority === "trending").length;
    
    return { total, personalized, unseen, trending };
  }, [articles]);

  return {
    articles,
    isLoading: isLoading || isLoadingPrefs,
    isRefreshing,
    error,
    hasMore,
    newArticlesCount,
    feedStats,
    loadFeed: refresh,
    loadMore,
    checkForNewArticles,
    dismissNewBadge,
    trackImpression,
    seenCount: seenArticleIds.size,
  };
}
