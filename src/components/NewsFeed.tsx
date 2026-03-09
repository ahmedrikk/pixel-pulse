import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, AlertCircle, X, Clock, Sparkles } from "lucide-react";
import { useSmartFeed } from "@/hooks/useSmartFeed";
import { EnhancedNewsCard } from "./EnhancedNewsCard";
import { NewsCardSkeleton } from "./NewsCardSkeleton";
import { Button } from "@/components/ui/button";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NewsFeedProps {
  onCardView?: (cardId: string) => void;
}

export function NewsFeed({ onCardView }: NewsFeedProps) {
  const { 
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
  } = useSmartFeed();
  
  const { activeTag, clearFilter } = useTagFilter();
  const [displayedCount, setDisplayedCount] = useState(6);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
          setDisplayedCount(prev => Math.min(prev + 5, articles.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, articles.length]);

  // Reset display count when filter changes
  useEffect(() => {
    setDisplayedCount(6);
  }, [activeTag]);

  // Scroll to top when filter is applied
  useEffect(() => {
    if (activeTag) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTag]);

  // Show new articles toast
  useEffect(() => {
    if (newArticlesCount > 0) {
      toast.success(
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <span>{newArticlesCount} new articles available</span>
        </div>,
        {
          action: {
            label: "Load",
            onClick: () => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              dismissNewBadge();
            },
          },
          duration: 5000,
        }
      );
    }
  }, [newArticlesCount, dismissNewBadge]);

  // Filter articles by active tag
  const filteredArticles = activeTag
    ? articles.filter((item) => item.topicTags.includes(activeTag) || item.gameTags.includes(activeTag))
    : articles;

  const displayedNews = filteredArticles.slice(0, displayedCount);

  // Feed priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "personalized":
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">For You</span>;
      case "trending":
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-medium">Trending</span>;
      case "new":
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">New</span>;
      default:
        return null;
    }
  };

  return (
    <main className="flex-1 space-y-4">
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Latest Gaming News</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={checkForNewArticles}
            disabled={isRefreshing}
            className="h-8 w-8"
            title="Check for new articles"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {isRefreshing && (
            <span className="text-xs text-muted-foreground">Checking...</span>
          )}
        </div>
        
        {/* Feed Stats (for debugging/visual feedback) */}
        {!isLoading && !activeTag && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            {feedStats.personalized > 0 && (
              <span className="px-2 py-1 rounded-full bg-primary/10">
                {feedStats.personalized} personalized
              </span>
            )}
            <span className="px-2 py-1 rounded-full bg-secondary">
              {feedStats.unseen} new
            </span>
          </div>
        )}
        
        <select className="bg-secondary text-foreground text-sm px-3 py-1.5 rounded-md border-0 focus:ring-2 focus:ring-primary">
          <option>Most Recent</option>
          <option>Most Popular</option>
          <option>Trending</option>
        </select>
      </div>

      {/* Active Filter Banner */}
      {activeTag && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium">
            Filtering by: <span className="text-primary font-bold">#{activeTag}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="ml-auto gap-1 h-7"
          >
            <X className="h-3 w-3" />
            Clear Filter
          </Button>
        </div>
      )}

      {/* Error/Fallback Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Live indicator with last updated */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Live from {filteredArticles.length} articles across gaming sources</span>
          </div>
        </div>
      )}

      {/* News Cards */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <NewsCardSkeleton key={`skeleton-${i}`} />
            ))
          ) : displayedNews.length > 0 ? (
            displayedNews.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="relative"
              >
                {/* New badge */}
                {item.isNew && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                      NEW
                    </span>
                  </div>
                )}
                
                {/* Priority badge */}
                <div className="absolute top-3 right-3 z-10">
                  {getPriorityBadge(item.priority)}
                </div>
                
                <EnhancedNewsCard 
                  article={item} 
                  onCardView={onCardView}
                />
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No articles found matching #{activeTag}</p>
              <Button variant="link" onClick={clearFilter} className="mt-2">
                View all articles
              </Button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Infinite Scroll Trigger */}
      {!isLoading && hasMore && displayedCount < filteredArticles.length && (
        <div ref={loadMoreRef} className="text-center py-6">
          <span className="text-muted-foreground text-sm">Loading more articles...</span>
        </div>
      )}

      {/* End of Feed */}
      {!isLoading && displayedCount >= filteredArticles.length && filteredArticles.length > 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          You've reached the end • {filteredArticles.length} articles
        </div>
      )}
    </main>
  );
}
