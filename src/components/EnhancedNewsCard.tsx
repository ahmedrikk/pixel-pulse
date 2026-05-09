import { useState, useEffect, useRef, useCallback } from "react";
import {
  ExternalLink,
  Share2,
  Bookmark,
  MessageCircle,
  Heart,
  Link2,
  Twitter,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Article, XP_VALUES, GameReview } from "@/types/feed";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EnhancedCommentSection } from "./EnhancedCommentSection";
import { GameReviewPrompt } from "./GameReviewPrompt";
import { fetchGameList } from "@/lib/rawg";
import { supabase } from "@/integrations/supabase/client";
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const JUNK_TAGS = new Set([
  "update","updates","gaming","news","videogames","game","games",
  "entertainment","fun","action","adventure","horror","sport","sports",
  "racing","puzzle","strategy","simulation","rpg","fps","moba",
  "multiplayer","singleplayer","coop","indie","streaming","trailer",
  "review","preview","rumor","leak","delay","dlc","remake","remaster",
]);
function isSpecificTag(tag: string): boolean {
  return !JUNK_TAGS.has(tag.toLowerCase());
}

export function EnhancedNewsCard({ article, onCardView }: EnhancedNewsCardProps) {
  const { setActiveTag } = useTagFilter();
  const { isAuthenticated, openAuthModal, user } = useAuthGate();
  const { addXP } = useXP();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(article.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [userReactions, setUserReactions] = useState<Record<string, number>>(article.reactions || {});
  const [hasAwardedView, setHasAwardedView] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [reviewGame, setReviewGame] = useState<{ id: string; name: string; coverUrl: string } | null>(null);

  const cardRef = useRef<HTMLElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);
  const hasTriggeredViewRef = useRef(false);
  const hasCheckedGameRef = useRef(false);

  const isCurrentlyBookmarked = isBookmarked(article.id);
  const primaryTag = article.topicTags.find(isSpecificTag) ?? null;

  const handleTagClick = (tag: string) => setActiveTag(tag);

  // Lazy RAWG lookup — only fires once per card, only for authenticated users
  const checkGameAndShowReview = useCallback(async (tag: string | null) => {
    if (!tag || !isAuthenticated || hasCheckedGameRef.current) {
      if (hasCheckedGameRef.current && reviewGame) setShowReviewPrompt(true);
      return;
    }
    hasCheckedGameRef.current = true;
    try {
      const { results } = await fetchGameList({ search: tag, page_size: 1 });
      if (results.length > 0) {
        const g = results[0];
        const tagNorm = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
        const nameNorm = g.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        // Require tag >= 6 chars and the tag prefix appears in the result name
        if (tagNorm.length < 6 || !nameNorm.includes(tagNorm.substring(0, 5))) return;
        setReviewGame({ id: String(g.id), name: g.name, coverUrl: g.background_image ?? "" });
        setShowReviewPrompt(true);
      }
    } catch { /* RAWG unavailable — silently skip */ }
  }, [isAuthenticated, reviewGame]);

  const handleLike = useCallback(() => {
    if (!isAuthenticated) { openAuthModal("like", { articleId: article.id }); return; }
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    if (!liked) {
      addXP(XP_VALUES.REACT);
      toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 });
      checkGameAndShowReview(primaryTag);
    }
  }, [isAuthenticated, liked, likeCount, article.id, openAuthModal, addXP, checkGameAndShowReview, primaryTag]);

  const handleReaction = useCallback((emoji: string) => {
    if (!isAuthenticated) { openAuthModal("react", { articleId: article.id }); return; }
    setUserReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    addXP(XP_VALUES.REACT);
    toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 });
    checkGameAndShowReview(primaryTag);
  }, [isAuthenticated, article.id, openAuthModal, addXP, checkGameAndShowReview, primaryTag]);

  const handleBookmark = useCallback(() => {
    if (!isAuthenticated) { openAuthModal("bookmark", { articleId: article.id }); return; }
    const newState = toggleBookmark(article);
    toast.success(newState ? "Saved to bookmarks" : "Removed from bookmarks");
    if (newState) checkGameAndShowReview(primaryTag);
  }, [isAuthenticated, article, openAuthModal, toggleBookmark, checkGameAndShowReview, primaryTag]);

  const handleReviewSubmit = useCallback(async (review: Omit<GameReview, "id" | "userId" | "createdAt">) => {
    if (!reviewGame || !user) return;
    await supabase.from("games").upsert(
      { id: reviewGame.id, name: reviewGame.name, slug: reviewGame.id, expires_at: new Date(Date.now() + 86400000).toISOString() },
      { onConflict: "id", ignoreDuplicates: true }
    );
    await supabase.from("user_game_reviews").insert({
      user_id: user.id,
      game_id: reviewGame.id,
      star_rating: review.starRating,
      review_text: review.reviewText || null,
      tags: review.tags,
    });
  }, [reviewGame, user]);

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
              dwellTimerRef.current = setTimeout(() => { awardViewXP(); }, 5000);
            }
          } else {
            isVisibleRef.current = false;
            if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
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

  const summaryText = article.summary || "";
  const displayTags = article.topicTags.slice(0, 4);
  const showImage = !imgError && !!article.heroImageUrl;

  return (
    <article
      ref={cardRef}
      className="bg-card rounded-xl border overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-200 group"
    >
      {/* Hero Image — only shown when URL exists and loads successfully */}
      {showImage && (
        <div className="relative aspect-video overflow-hidden">
          <img
            src={article.heroImageUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
          {primaryTag && (
            <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-tag text-tag-foreground text-xs font-semibold">
              #{primaryTag}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Tag pill when no image */}
        {!showImage && primaryTag && (
          <div className="mb-2">
            <span className="px-2 py-1 rounded-md bg-tag text-tag-foreground text-xs font-semibold">
              #{primaryTag}
            </span>
          </div>
        )}

        {/* Source Bar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{article.sourceName}</span>
          <span>•</span>
          <span>{formatDate(article.publishedAt)}</span>
          <span>•</span>
          <span>by {article.author}</span>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight line-clamp-3">
          {article.title}
        </h2>

        {/* Summary */}
        <div className="mb-4">
          <p className="text-muted-foreground leading-relaxed">
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
              className={cn("gap-1", liked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500")}
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
              className={cn("text-muted-foreground hover:text-primary", isCurrentlyBookmarked && "text-primary")}
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
                  <Link2 className="h-4 w-4 mr-2" /> Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare("twitter")}>
                  <Twitter className="h-4 w-4 mr-2" /> Share on X
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Share on WhatsApp
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
          <EnhancedCommentSection articleId={article.id} className="mt-4" />
        )}

        {/* Game Review Prompt — only when RAWG confirmed the game exists */}
        {reviewGame && (
          <GameReviewPrompt
            articleId={article.id}
            gameId={reviewGame.id}
            gameName={reviewGame.name}
            gameCoverUrl={reviewGame.coverUrl}
            isVisible={showReviewPrompt}
            onDismiss={() => setShowReviewPrompt(false)}
            onSubmit={handleReviewSubmit}
          />
        )}
      </div>
    </article>
  );
}
