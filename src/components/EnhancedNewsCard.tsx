import { useState, useEffect, useRef, useCallback } from "react";
import { 
  ExternalLink, 
  Share2, 
  Bookmark, 
  MessageCircle, 
  Heart,
  Clock,
  MoreHorizontal,
  Check,
  Link2,
  Twitter,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Article, XP_VALUES } from "@/types/feed";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { useAuthGate, useGatedAction } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EnhancedCommentSection } from "./EnhancedCommentSection";
import { GameReviewPrompt } from "./GameReviewPrompt";
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

// Quick emoji reactions
const QUICK_REACTIONS = [
  { emoji: "👍", key: "thumbsup", label: "Like" },
  { emoji: "❤️", key: "heart", label: "Love" },
  { emoji: "🔥", key: "fire", label: "Fire" },
  { emoji: "😮", key: "wow", label: "Wow" },
];

// Format date to relative time
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Trim summary to max 280 characters at word boundary
function normaliseSummary(summary: string): string {
  if (!summary) return "";
  if (summary.length <= 280) return summary;
  const cut = summary.substring(0, 279);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 200 ? cut.substring(0, lastSpace) : cut) + "…";
}

export function EnhancedNewsCard({ article, onCardView }: EnhancedNewsCardProps) {
  const { setActiveTag } = useTagFilter();
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(article.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [userReactions, setUserReactions] = useState<Record<string, number>>(article.reactions || {});
  const [hasAwardedView, setHasAwardedView] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  
  const cardRef = useRef<HTMLElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);
  const hasTriggeredViewRef = useRef(false);

  const isCurrentlyBookmarked = isBookmarked(article.id);

  // Handle tag click
  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
  };

  // Handle like (auth-gated)
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

  // Handle reaction (auth-gated)
  const handleReaction = useCallback((emoji: string) => {
    if (!isAuthenticated) {
      openAuthModal("react", { articleId: article.id });
      return;
    }
    
    setUserReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
    
    addXP(XP_VALUES.REACT);
    toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 });
  }, [isAuthenticated, article.id, openAuthModal, addXP]);

  // Handle bookmark (auth-gated)
  const handleBookmark = useCallback(() => {
    if (!isAuthenticated) {
      openAuthModal("bookmark", { articleId: article.id });
      return;
    }
    
    const newState = toggleBookmark(article);
    toast.success(newState ? "Saved to bookmarks" : "Removed from bookmarks");
  }, [isAuthenticated, article, openAuthModal, toggleBookmark]);

  // Handle share
  const handleShare = useCallback(async (type: "copy" | "twitter" | "whatsapp") => {
    const url = article.sourceUrl;
    const text = `Check out: ${article.title}`;
    
    switch (type) {
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
        break;
    }
  }, [article]);

  // Award view XP after 5s dwell
  const awardViewXP = useCallback(() => {
    if (hasAwardedView) return;
    
    setHasAwardedView(true);
    addXP(XP_VALUES.VIEW_SUMMARY);
    
    // Show review prompt if article matches fav games
    if (article.gameTags.length > 0) {
      setShowReviewPrompt(true);
    }
  }, [hasAwardedView, addXP, article.gameTags.length]);

  // Track card view
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!isVisibleRef.current && !hasAwardedView) {
              isVisibleRef.current = true;
              
              // Notify parent component
              if (onCardView && !hasTriggeredViewRef.current) {
                onCardView(article.id);
                hasTriggeredViewRef.current = true;
              }
              
              // Start dwell timer
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
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, [article.id, awardViewXP, hasAwardedView, onCardView]);

  // Handle read full article
  const handleReadFull = useCallback(() => {
    addXP(XP_VALUES.READ_FULL_ARTICLE);
    toast.success(`+${XP_VALUES.READ_FULL_ARTICLE} XP!`, { duration: 1500 });
  }, [addXP]);

  const summaryText = normaliseSummary(article.summary);

  // Show top 4 tags
  const displayTags = article.topicTags.slice(0, 4);

  return (
    <article
      ref={cardRef}
      className="bg-card rounded-xl border overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-200 group"
    >
      {/* Hero Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={article.heroImageUrl}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-tag text-tag-foreground text-xs font-semibold">
          #{article.gameTags[0] || "Gaming"}
        </span>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Source Bar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{article.sourceName}</span>
          <span>•</span>
          <span>{formatDate(article.publishedAt)}</span>
          <span>•</span>
          <span>by {article.author}</span>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight line-clamp-2">
          {article.title}
        </h2>

        {/* Summary — fixed 4-line display, uniform across all cards */}
        <div className="mb-4 h-[5.5rem] overflow-hidden">
          <p className="text-muted-foreground leading-[1.375rem] line-clamp-4">
            {summaryText}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {displayTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="px-2 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              #{tag}
            </button>
          ))}
        </div>

        {/* Reaction Row */}
        <div className="flex items-center gap-1 mb-3">
          {QUICK_REACTIONS.map(({ emoji, key }) => (
            <button
              key={key}
              onClick={() => handleReaction(emoji)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/50 hover:bg-secondary transition-colors text-sm"
              title={key}
            >
              <span>{emoji}</span>
              {userReactions[emoji] > 0 && (
                <span className="text-xs text-muted-foreground">{userReactions[emoji]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "gap-1",
                liked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
              )}
              onClick={handleLike}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              <span className="text-xs">{likeCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 text-muted-foreground hover:text-primary"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{article.comments}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "text-muted-foreground hover:text-primary",
                isCurrentlyBookmarked && "text-primary"
              )}
              onClick={handleBookmark}
            >
              <Bookmark className={cn("h-4 w-4", isCurrentlyBookmarked && "fill-current")} />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleShare("copy")}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare("twitter")}>
                  <Twitter className="h-4 w-4 mr-2" />
                  Share on X
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Share on WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button asChild size="sm" className="gap-2" onClick={handleReadFull}>
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
              Read Full Article
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <EnhancedCommentSection
            articleId={article.id}
            className="mt-4"
          />
        )}

        {/* Game Review Prompt */}
        {showReviewPrompt && article.gameTags[0] && (
          <GameReviewPrompt
            articleId={article.id}
            gameId={article.gameTags[0]}
            gameName={article.gameTags[0]}
            gameCoverUrl={article.heroImageUrl}
            isVisible={showReviewPrompt}
            onDismiss={() => setShowReviewPrompt(false)}
            onSubmit={(review) => {
              console.log("Review submitted:", review);
              setShowReviewPrompt(false);
            }}
          />
        )}
      </div>
    </article>
  );
}
