import { useState, useEffect, useRef, useCallback } from "react";
import {
  ExternalLink,
  Share2,
  Bookmark,
  MessageCircle,
  Heart,
  Link2,
  Twitter,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Article, XP_VALUES } from "@/types/feed";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EnhancedCommentSection } from "./EnhancedCommentSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EnhancedNewsCardProps {
  article: Article;
  onCardView?: (cardId: string) => void;
}

const QUICK_REACTIONS = [
  { emoji: "👍", key: "thumbsup", label: "Like" },
  { emoji: "❤️", key: "heart", label: "Love" },
  { emoji: "🔥", key: "fire", label: "Fire" },
  { emoji: "😮", key: "wow", label: "Wow" },
];

// Source color mapping
const SOURCE_COLORS: Record<string, string> = {
  IGN: "bg-red-500",
  Kotaku: "bg-pink-500",
  Polygon: "bg-purple-500",
  GameSpot: "bg-blue-500",
  Dexerto: "bg-yellow-500",
  PCGamer: "bg-green-500",
  Eurogamer: "bg-indigo-500",
  RPS: "bg-orange-500",
  Gematsu: "bg-cyan-500",
  VG247: "bg-teal-500",
  Sportskeeda: "bg-lime-500",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const JUNK_TAGS = new Set([
  "update", "updates", "gaming", "news", "videogames", "game", "games",
  "entertainment", "fun", "action", "adventure", "horror", "sport", "sports",
  "racing", "puzzle", "strategy", "simulation", "rpg", "fps", "moba",
  "multiplayer", "singleplayer", "coop", "indie", "streaming", "trailer",
  "review", "preview", "rumor", "leak", "delay", "dlc", "remake", "remaster",
]);

function isSpecificTag(tag: string): boolean {
  return !JUNK_TAGS.has(tag.toLowerCase());
}

export function EnhancedNewsCard({ article, onCardView }: EnhancedNewsCardProps) {
  const { setActiveTag } = useTagFilter();
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(article.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [userReactions, setUserReactions] = useState<Record<string, number>>(
    article.reactions || {}
  );
  const [hasAwardedView, setHasAwardedView] = useState(false);
  const [imgError, setImgError] = useState(false);

  const cardRef = useRef<HTMLElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);
  const hasTriggeredViewRef = useRef(false);

  const isCurrentlyBookmarked = isBookmarked(article.id);
  const summaryText = article.summary || "";
  const primaryTag = article.topicTags.find(isSpecificTag) ?? null;
  const displayTags = article.topicTags.slice(0, 3);

  const handleTagClick = (tag: string) => setActiveTag(tag);

  const handleLike = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal("like", { articleId: article.id });
      return;
    }
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    if (!liked) {
      addXP(XP_VALUES.REACT);
      toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 });
    }
  }, [isAuthenticated, liked, likeCount, article.id, openAuthModal, addXP]);

  const handleReaction = useCallback(
    (emoji: string) => {
      if (!isAuthenticated) {
        openAuthModal("react", { articleId: article.id });
        return;
      }
      setUserReactions((prev) => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1,
      }));
      addXP(XP_VALUES.REACT);
      toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 });
    },
    [isAuthenticated, article.id, openAuthModal, addXP]
  );

  const handleBookmark = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal("bookmark", { articleId: article.id });
      return;
    }
    const newState = toggleBookmark(article);
    toast.success(newState ? "Saved to bookmarks" : "Removed from bookmarks");
  }, [isAuthenticated, article, openAuthModal, toggleBookmark]);

  const handleShare = useCallback(
    async (type: "copy" | "twitter" | "whatsapp") => {
      const url = article.sourceUrl;
      const text = `Check out: ${article.title}`;
      switch (type) {
        case "copy":
          await navigator.clipboard.writeText(url);
          toast.success("Link copied to clipboard");
          break;
        case "twitter":
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
            "_blank"
          );
          break;
        case "whatsapp":
          window.open(
            `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
            "_blank"
          );
          break;
      }
    },
    [article]
  );

  const awardViewXP = useCallback(() => {
    if (hasAwardedView) return;
    setHasAwardedView(true);
    addXP(XP_VALUES.VIEW_SUMMARY);
  }, [hasAwardedView, addXP]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!isVisibleRef.current && !hasAwardedView) {
              isVisibleRef.current = true;
              if (onCardView && !hasTriggeredViewRef.current) {
                onCardView(article.id);
                hasTriggeredViewRef.current = true;
              }
              dwellTimerRef.current = setTimeout(() => {
                awardViewXP();
              }, 5000);
            }
          } else {
            isVisibleRef.current = false;
            if (dwellTimerRef.current) {
              clearTimeout(dwellTimerRef.current);
              dwellTimerRef.current = null;
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(card);
    return () => {
      observer.disconnect();
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [article.id, awardViewXP, hasAwardedView, onCardView]);

  const handleReadFull = useCallback(() => {
    addXP(XP_VALUES.READ_FULL_ARTICLE);
    toast.success(`+${XP_VALUES.READ_FULL_ARTICLE} XP!`, { duration: 1500 });
  }, [addXP]);

  const sourceColor = SOURCE_COLORS[article.sourceName] || "bg-gray-500";

  return (
    <article
      ref={cardRef}
      className="bg-card rounded-lg border overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-200 group"
    >
      {/* HORIZONTAL LAYOUT: Image left, Content right */}
      <div className="flex flex-row h-[140px]">
        {/* Left: Thumbnail Image (fixed width) */}
        <div className="relative w-[180px] flex-shrink-0 overflow-hidden bg-muted">
          {!imgError && article.heroImageUrl ? (
            <img
              src={article.heroImageUrl}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-4xl">🎮</span>
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 flex flex-col justify-between p-4 min-w-0">
          {/* Top: Source + Tag + Date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            {/* Source with colored dot */}
            <div className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", sourceColor)} />
              <span className="font-medium text-foreground">{article.sourceName}</span>
            </div>
            <span>•</span>
            <span>{formatDate(article.publishedAt)}</span>
            {primaryTag && (
              <>
                <span>•</span>
                <button
                  onClick={() => handleTagClick(primaryTag)}
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  #{primaryTag}
                </button>
              </>
            )}
          </div>

          {/* Title - line clamp 2 */}
          <h2 className="text-base font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-1">
            {article.title}
          </h2>

          {/* Summary - line clamp 2, fixed height */}
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {summaryText}
          </p>

          {/* Bottom: Reactions + Actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            {/* Quick Reactions */}
            <div className="flex items-center gap-0.5">
              {QUICK_REACTIONS.map(({ emoji, key }) => (
                <button
                  key={key}
                  onClick={() => handleReaction(emoji)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full hover:bg-secondary transition-colors text-sm"
                  title={key}
                >
                  <span>{emoji}</span>
                  {userReactions[emoji] > 0 && (
                    <span className="text-xs text-muted-foreground">{userReactions[emoji]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleLike}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 transition-colors",
                    liked ? "fill-red-500 text-red-500" : "text-muted-foreground"
                  )}
                />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[1rem]">{likeCount || ""}</span>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", isCurrentlyBookmarked && "text-primary")}
                onClick={handleBookmark}
              >
                <Bookmark
                  className={cn(
                    "h-4 w-4",
                    isCurrentlyBookmarked ? "fill-current" : "text-muted-foreground"
                  )}
                />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleShare("copy")}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare("twitter")}>
                    <Twitter className="mr-2 h-4 w-4" />
                    Share on Twitter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Share on WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleReadFull}
                asChild
              >
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  Read
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t px-4 py-3">
          <EnhancedCommentSection articleId={article.id} />
        </div>
      )}
    </article>
  );
}
