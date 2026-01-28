import { RefreshCw, AlertCircle } from "lucide-react";
import { useGamingNews } from "@/hooks/useGamingNews";
import { NewsCard } from "./NewsCard";
import { NewsCardSkeleton } from "./NewsCardSkeleton";
import { Button } from "@/components/ui/button";

export function NewsFeed() {
  const { news, isLoading, error, isUsingFallback, refresh } = useGamingNews();

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
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <select className="bg-secondary text-foreground text-sm px-3 py-1.5 rounded-md border-0 focus:ring-2 focus:ring-primary">
          <option>Most Recent</option>
          <option>Most Popular</option>
          <option>Trending</option>
        </select>
      </div>

      {/* Error/Fallback Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Live indicator */}
      {!isLoading && !isUsingFallback && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>Live from {news.length} articles across gaming sources</span>
        </div>
      )}

      {/* News Cards */}
      <div className="space-y-4">
        {isLoading ? (
          // Skeleton loaders
          Array.from({ length: 4 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))
        ) : (
          news.map((item) => (
            <NewsCard key={item.id} news={item} />
          ))
        )}
      </div>

      {/* Load More */}
      {!isLoading && news.length > 0 && (
        <div className="text-center py-6">
          <button className="text-primary font-medium hover:underline">
            Load more articles...
          </button>
        </div>
      )}
    </main>
  );
}
