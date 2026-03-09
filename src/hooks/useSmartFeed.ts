import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Article, RankedArticle, FeedPriority, UserImpression, DEFAULT_FEED_CONFIG } from "@/types/feed";
import { INITIAL_NEWS } from "@/data/mockNews";

// Helper to convert NewsItem to Article
const convertToArticle = (news: typeof INITIAL_NEWS[0]): Article => ({
  id: news.id,
  title: news.title,
  summary: news.summary,
  summaryWordCount: news.summary.split(" ").length,
  sourceName: news.source,
  sourceUrl: news.sourceUrl,
  author: news.author,
  heroImageUrl: news.imageUrl,
  gameTags: news.tags.filter(t => ["PlayStation", "Xbox", "PCGaming", "Nintendo", "FPS", "RPG", "Indie"].includes(t)),
  topicTags: news.tags,
  publishedAt: news.timestamp,
  fetchedAt: news.timestamp,
  engagementScore: news.likes || 0,
  likes: news.likes || 0,
  comments: news.comments || 0,
  reactions: {},
});

// Mock current user - in real app, get from auth context
const CURRENT_USER = {
  id: "user-1",
  favGames: ["FPS", "RPG", "PlayStation"],
};

interface UseSmartFeedOptions {
  userId?: string;
  favGames?: string[];
  pageSize?: number;
}

export function useSmartFeed(options: UseSmartFeedOptions = {}) {
  const { favGames = CURRENT_USER.favGames, pageSize = DEFAULT_FEED_CONFIG.pageSize } = options;
  
  const [articles, setArticles] = useState<RankedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  
  // Track seen articles in session
  const seenArticleIds = useRef<Set<string>>(new Set());
  const impressionsRef = useRef<Map<string, UserImpression>>(new Map());
  const lastLoadTimeRef = useRef<Date>(new Date());

  // Convert mock data to Article format
  const allArticles = useMemo(() => INITIAL_NEWS.map(convertToArticle), []);

  // Calculate priority score for ranking
  const calculatePriority = useCallback((article: Article): { priority: FeedPriority; score: number } => {
    const isSeen = seenArticleIds.current.has(article.id);
    const isFavGameMatch = favGames.some(game => article.gameTags.includes(game));
    
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
  }, [favGames]);

  // Rank and sort articles
  const rankArticles = useCallback((articlesToRank: Article[]): RankedArticle[] => {
    const ranked = articlesToRank.map(article => {
      const { priority, score } = calculatePriority(article);
      return { ...article, priority, priorityScore: score };
    });
    
    // Sort by priority score (descending)
    return ranked.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [calculatePriority]);

  // Load initial feed
  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get first page of ranked articles
      const ranked = rankArticles(allArticles);
      const firstPage = ranked.slice(0, pageSize);
      
      // Mark as seen
      firstPage.forEach(article => {
        seenArticleIds.current.add(article.id);
        impressionsRef.current.set(article.id, {
          id: `imp-${article.id}`,
          userId: CURRENT_USER.id,
          articleId: article.id,
          seenAt: new Date().toISOString(),
          readFull: false,
          dwellSeconds: 0,
        });
      });
      
      setArticles(firstPage);
      setHasMore(ranked.length > pageSize);
      lastLoadTimeRef.current = new Date();
    } catch (err) {
      setError("Failed to load feed");
    } finally {
      setIsLoading(false);
    }
  }, [allArticles, pageSize, rankArticles]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const ranked = rankArticles(allArticles);
      const currentLength = articles.length;
      const nextPage = ranked.slice(currentLength, currentLength + pageSize);
      
      if (nextPage.length === 0) {
        setHasMore(false);
        return;
      }
      
      // Mark new articles as seen
      nextPage.forEach(article => {
        seenArticleIds.current.add(article.id);
      });
      
      setArticles(prev => [...prev, ...nextPage]);
      setHasMore(currentLength + nextPage.length < ranked.length);
    } catch (err) {
      setError("Failed to load more articles");
    } finally {
      setIsLoading(false);
    }
  }, [allArticles, articles.length, hasMore, isLoading, pageSize, rankArticles]);

  // Check for new articles on refresh
  const checkForNewArticles = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Find articles published after last load
      const newArticles = allArticles.filter(article => {
        const pubDate = new Date(article.publishedAt);
        return pubDate > lastLoadTimeRef.current && !seenArticleIds.current.has(article.id);
      });
      
      if (newArticles.length > 0) {
        setNewArticlesCount(newArticles.length);
        // Mark as new for badge display
        const rankedNew = rankArticles(newArticles).map(a => ({ ...a, isNew: true }));
        // Prepend to feed
        setArticles(prev => [...rankedNew, ...prev]);
        newArticles.forEach(a => seenArticleIds.current.add(a.id));
      }
      
      lastLoadTimeRef.current = new Date();
    } finally {
      setIsRefreshing(false);
    }
  }, [allArticles, rankArticles]);

  // Dismiss new articles badge
  const dismissNewBadge = useCallback(() => {
    setNewArticlesCount(0);
    setArticles(prev => prev.map(a => ({ ...a, isNew: false })));
  }, []);

  // Track impression with dwell time
  const trackImpression = useCallback((articleId: string, dwellSeconds: number, readFull: boolean = false) => {
    const impression = impressionsRef.current.get(articleId);
    if (impression) {
      impression.dwellSeconds = dwellSeconds;
      impression.readFull = readFull;
      impressionsRef.current.set(articleId, impression);
    }
  }, []);

  // Get feed stats
  const feedStats = useMemo(() => {
    const total = articles.length;
    const personalized = articles.filter(a => a.priority === "personalized").length;
    const unseen = articles.filter(a => a.priority === "unseen").length;
    const trending = articles.filter(a => a.priority === "trending").length;
    
    return { total, personalized, unseen, trending };
  }, [articles]);

  // Initial load
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return {
    articles,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    newArticlesCount,
    feedStats,
    loadFeed,
    loadMore,
    checkForNewArticles,
    dismissNewBadge,
    trackImpression,
    seenCount: seenArticleIds.current.size,
  };
}
