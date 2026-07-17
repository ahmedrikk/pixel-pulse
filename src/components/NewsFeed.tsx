import { useState, useEffect, useRef } from "react";
import { RefreshCw, AlertCircle, Sparkles, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSmartFeedReal } from "@/hooks/useSmartFeedReal";
import { EnhancedNewsCard } from "./EnhancedNewsCard";
import { NewsCardSkeleton } from "./NewsCardSkeleton";
import { InFeedSignupPrompt } from "./InFeedSignupPrompt";
import { Button } from "@/components/ui/button";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { MobileCategoryScroll } from "@/components/sidebar/CategoryPillsWidget";
import { FeedHigherLowerCard, FeedSentimentCard } from "@/components/hub/HubEngagementWidgets";
import type { RankedArticle } from "@/types/feed";

interface NewsFeedProps {
  onCardView?: (cardId: string) => void;
}

type FeedEntry =
  | { type: "article"; article: RankedArticle; index: number }
  | { type: "signup"; key: string }
  | { type: "higher-lower"; key: string }
  | { type: "sentiment"; key: string };

function buildFeedEntries(articles: RankedArticle[], isAuthenticated: boolean): FeedEntry[] {
  const entries: FeedEntry[] = [];
  let pendingWidget: "higher-lower" | "sentiment" | null = null;
  articles.forEach((article, index) => {
    const position = index + 1;
    entries.push({ type: "article", article, index });

    const showSignup = !isAuthenticated && position % 3 === 0;
    if (showSignup) entries.push({ type: "signup", key: `signup-${position}` });

    if (pendingWidget && !showSignup) {
      entries.push({ type: pendingWidget, key: `${pendingWidget}-deferred-${position}` });
      pendingWidget = null;
    }

    const scheduledWidget = position % 10 === 5
      ? "higher-lower"
      : position % 10 === 0
        ? "sentiment"
        : null;
    if (scheduledWidget) {
      if (showSignup) pendingWidget = scheduledWidget;
      else entries.push({ type: scheduledWidget, key: `${scheduledWidget}-${position}` });
    }
  });
  return entries;
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function NewsFeed({ onCardView }: NewsFeedProps) {
  const { isAuthenticated, user } = useAuthGate();

  const {
    articles,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    newArticlesCount,
    loadFeed,
    loadMore,
    dismissNewBadge,
    trackImpression,
  } = useSmartFeedReal({
    userId: isAuthenticated ? user?.id : undefined
  });
  
  const { activeTag, categoryName } = useTagFilter();
  const navigate = useNavigate();
  const exitFilter = () => navigate("/");
  const [displayedCount, setDisplayedCount] = useState(6);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter articles by active tag — must be declared before the observer useEffect
  const normalizedActiveTag = activeTag ? normalizeTag(activeTag) : null;
  const tagFiltered = activeTag
    ? articles.filter((item) =>
        [...item.topicTags, ...item.gameTags].some(
          (tag) => normalizeTag(tag) === normalizedActiveTag
        )
      )
    : articles;

  const filteredArticles = tagFiltered;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (displayedCount < filteredArticles.length) {
            // Still have local articles to reveal
            setDisplayedCount(prev => Math.min(prev + 5, filteredArticles.length));
          } else if (hasMore && !isLoading && !isLoadingMore) {
            // Local list exhausted but DB has more — fetch next page
            loadMore();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [displayedCount, filteredArticles.length, hasMore, isLoading, isLoadingMore, loadMore]);

  // Reset display count when filter changes
  useEffect(() => {
    setDisplayedCount(6);
  }, [activeTag]);

  const displayedNews = filteredArticles.slice(0, displayedCount);
  const feedEntries = buildFeedEntries(displayedNews, isAuthenticated);

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "personalized":
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">For You</span>;
      case "trending":
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-500 font-medium">Trending</span>;
      case "fresh":
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">New</span>;
      default:
        return null;
    }
  };

  return (
    <main className="flex-1 space-y-4">
      {/* ── Mobile: Category pill horizontal scroll (hidden on lg+) ── */}
      <div className="block lg:hidden">
        <MobileCategoryScroll />
      </div>

      {/* Category navigation only appears when the feed is filtered. */}
      {activeTag && (
        <div className="flex items-center justify-between border-b pb-3">
          <button
            onClick={exitFilter}
            className="group flex min-w-0 items-center gap-2.5"
            title="Back to feed"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border bg-card transition-colors group-hover:bg-secondary">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-lg font-bold">#{categoryName ?? activeTag}</h1>
              <p className="text-xs text-muted-foreground">{filteredArticles.length} articles</p>
            </div>
          </button>
        </div>
      )}

      {/* New Articles Banner */}
      {newArticlesCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
        >
          <Sparkles className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">
            {newArticlesCount} new article{newArticlesCount > 1 ? 's' : ''} available
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              dismissNewBadge();
            }}
            className="ml-auto gap-1 h-7"
          >
            View
          </Button>
        </motion.div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <Button variant="ghost" size="sm" onClick={loadFeed} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* News Cards */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={`skeleton-${i}`}>
                <NewsCardSkeleton />
              </motion.div>
            ))
          ) : displayedNews.length > 0 ? (
            feedEntries.map((entry) => {
              if (entry.type === "signup") {
                return <motion.div key={entry.key} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><InFeedSignupPrompt /></motion.div>;
              }
              if (entry.type === "higher-lower") {
                return <motion.div key={entry.key} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><FeedHigherLowerCard /></motion.div>;
              }
              if (entry.type === "sentiment") {
                return <motion.div key={entry.key} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><FeedSentimentCard /></motion.div>;
              }
              const { article: item, index } = entry;
              return (
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
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>{activeTag ? `No articles found matching #${activeTag}` : "No articles available yet."}</p>
              {activeTag ? (
                <Button variant="link" onClick={exitFilter} className="mt-2">
                  View all articles
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={loadFeed}
                  disabled={isRefreshing}
                  className="mt-4 gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Fetch latest news
                </Button>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Infinite Scroll Trigger / Loading Indicator */}
      {!isLoading && !isLoadingMore && (displayedCount < filteredArticles.length || hasMore) && (
        <div ref={loadMoreRef} className="text-center py-8">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-primary/50" />
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {displayedCount < filteredArticles.length ? "Revealing more" : "Fetching deeper news"}
            </span>
          </div>
        </div>
      )}

      {/* End of Feed */}
      {!isLoading && !hasMore && displayedCount >= filteredArticles.length && filteredArticles.length > 0 && (
        <div className="text-center py-12 border-t border-border mt-8">
          <div className="bg-secondary/30 inline-block px-4 py-2 rounded-full">
            <span className="text-muted-foreground text-sm font-medium">
              You've reached the end • {filteredArticles.length} articles
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
