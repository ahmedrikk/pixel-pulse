import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, AlertCircle, X, Clock } from "lucide-react";
import { useGamingNews } from "@/hooks/useGamingNews";
import { NewsCard } from "./NewsCard";
import { NewsCardSkeleton } from "./NewsCardSkeleton";
import { Button } from "@/components/ui/button";
import { useTagFilter } from "@/contexts/TagFilterContext";

interface NewsFeedProps {
  onCardView?: (cardId: string) => void;
}

export function NewsFeed({ onCardView }: NewsFeedProps) {
  const { news, isLoading, isRefreshing, error, isUsingFallback, lastUpdated, refresh } = useGamingNews();
  const { activeTag, clearFilter } = useTagFilter();
  const [displayedCount, setDisplayedCount] = useState(6);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter news by active tag
  const filteredNews = activeTag
    ? news.filter((item) => item.tags.includes(activeTag))
    : news;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < filteredNews.length) {
          setDisplayedCount((prev) => Math.min(prev + 5, filteredNews.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [displayedCount, filteredNews.length]);

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

  const displayedNews = filteredNews.slice(0, displayedCount);

  return (
    <main className="flex-1 space-y-4">
      {/* Feed Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Latest Gaming News</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh}
            disabled={isLoading || isRefreshing}
            className="h-8 w-8"
            title="Refresh articles"
          >
            <RefreshCw className={`h-4 w-4 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
          </Button>
          {isRefreshing && (
            <span className="text-xs text-muted-foreground">Updating...</span>
          )}
        </div>
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
      {!isLoading && !isUsingFallback && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Live from {filteredNews.length} articles across gaming sources</span>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      )}

      {/* News Cards */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))
        ) : displayedNews.length > 0 ? (
          displayedNews.map((item) => (
            <CardViewTracker key={item.id} cardId={item.id} onView={onCardView}>
              <NewsCard news={item} />
            </CardViewTracker>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No articles found matching #{activeTag}</p>
            <Button variant="link" onClick={clearFilter} className="mt-2">
              View all articles
            </Button>
          </div>
        )}
      </div>

      {/* Infinite Scroll Trigger */}
      {!isLoading && displayedCount < filteredNews.length && (
        <div ref={loadMoreRef} className="text-center py-6">
          <span className="text-muted-foreground text-sm">Loading more articles...</span>
        </div>
      )}

      {/* End of Feed */}
      {!isLoading && displayedCount >= filteredNews.length && filteredNews.length > 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          You've reached the end • {filteredNews.length} articles
        </div>
      )}
    </main>
  );
}

function CardViewTracker({
  cardId,
  onView,
  children,
}: {
  cardId: string;
  onView?: (id: string) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onView || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView(cardId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [cardId, onView]);

  return <div ref={ref}>{children}</div>;
}
