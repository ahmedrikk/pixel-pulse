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
import { awardXP } from "@/lib/xp";
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

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  // Sanity check: negative diff means future date, very large diff = bad data
  if (diffInHours < 0 || diffInHours > 365 * 24 * 10) return "Recently";
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  const diffDays = Math.floor(diffInHours / 24);
  if (diffDays < 365) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const { addXP, refreshFromServer } = useXP();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(article.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [userReactions, setUserReactions] = useState<Record<string, number>>(article.reactions || {});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
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

  // Lazy RAWG lookup — only fires once per card, only for authenticated users.
  // Prefers the article's explicit gameTags (real game names), falls back to
  // specific topic tags, then finally tries the article title itself so that
  // articles with no tags (e.g. "Overwatch celebrates 10 years") still trigger.
  const checkGameAndShowReview = useCallback(async () => {
    if (!isAuthenticated) return;
    // Already resolved on a prior interaction — just re-show the prompt.
    if (hasCheckedGameRef.current) {
      if (reviewGame) setShowReviewPrompt(true);
      return;
    }

    // Candidate game names: explicit gameTags first, then non-junk topic tags.
    // Tags are PascalCase ("ModernWarfare4") but RAWG search needs spaces
    // ("Modern Warfare 4") — it returns zero results for the squashed form.
    const dePascal = (t: string) =>
      t
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([a-zA-Z])(\d)/g, "$1 $2")
        .trim();
    const tagCandidates = [
      ...article.gameTags,
      ...article.topicTags.filter(isSpecificTag),
    ]
      .map((t) => dePascal(t.trim()))
      .filter((t, i, arr) => t.length >= 3 && arr.indexOf(t) === i);

    hasCheckedGameRef.current = true;

    // Helper: try one candidate tag against RAWG.
    // For tag-based candidates: require a shared prefix.
    // For title-based fallback: accept if the RAWG game name appears in the title.
    const tryCandidate = async (candidate: string, isTitleFallback: boolean): Promise<boolean> => {
      try {
        const { results } = await fetchGameList({ search: candidate, page_size: 5 });
        if (results.length === 0) return false;

        // RAWG relevance search surfaces obscure name-twins first
        // ("Halo (itch)" for "Halo") — prefer games people actually know,
        // falling back to the raw list only if nothing popular matches.
        const popular = results.filter((r) => (r.added ?? 0) >= 50);
        const pool = popular.length > 0 ? popular : results;

        for (const g of pool) {
          const nameNorm = g.name.toLowerCase().replace(/[^a-z0-9]/g, "");

          if (isTitleFallback) {
            // Title fallback: accept if the matched game name appears in the title
            const titleLower = article.title.toLowerCase();
            // Strip the " 2", " 3" suffix for a looser base match too
            const baseName = g.name.replace(/\s*\d+$/, "").toLowerCase();
            if (!titleLower.includes(baseName) && !titleLower.includes(g.name.toLowerCase())) continue;
          } else {
            const tagNorm = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (tagNorm.length < 3) return false;
            const tagPrefix = tagNorm.substring(0, Math.min(4, tagNorm.length));
            const namePrefix = nameNorm.substring(0, Math.min(4, nameNorm.length));
            if (!nameNorm.includes(tagPrefix) && !tagNorm.includes(namePrefix)) continue;
          }

          setReviewGame({ id: String(g.id), name: g.name, coverUrl: g.background_image ?? "" });
          setShowReviewPrompt(true);
          return true;
        }
        return false;
      } catch { return false; }
    };

    // 1. Try explicit tag candidates first
    for (const tag of tagCandidates) {
      if (await tryCandidate(tag, false)) return;
    }

    // 2. No tags matched — fall back to the article title
    if (article.title.trim().length >= 3) {
      await tryCandidate(article.title, true);
    }
  }, [isAuthenticated, reviewGame, article.gameTags, article.topicTags, article.title]);

  const handleLike = useCallback(async () => {
    if (!isAuthenticated) { openAuthModal("like", { articleId: article.id }); return; }
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    if (!liked) {
      const result = await awardXP("react", article.sourceUrl);
      if (result && result.awarded > 0) {
        toast.success(`+${result.awarded} XP! Tier ${result.tier}`, { duration: 1500 });
        await refreshFromServer();
      } else if (result?.capped) {
        toast.info("Daily XP cap reached — come back tomorrow!", { duration: 2000 });
      }
      checkGameAndShowReview();
    }
  }, [isAuthenticated, liked, likeCount, article.id, article.sourceUrl, openAuthModal, addXP, refreshFromServer, checkGameAndShowReview]);

  const handleReaction = useCallback(async (emoji: string) => {
    if (!isAuthenticated) { openAuthModal("react", { articleId: article.id }); return; }

    // Toggle: clicking an emoji you already reacted with removes it
    if (myReactions.has(emoji)) {
      setMyReactions(prev => { const next = new Set(prev); next.delete(emoji); return next; });
      setUserReactions(prev => ({ ...prev, [emoji]: Math.max((prev[emoji] || 1) - 1, 0) }));
      return;
    }

    setMyReactions(prev => new Set(prev).add(emoji));
    setUserReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    const result = await awardXP("react", article.sourceUrl);
    if (result && result.awarded > 0) {
      toast.success(`+${result.awarded} XP! Tier ${result.tier}`, { duration: 1500 });
      await refreshFromServer();
    } else if (result?.capped) {
      toast.info("Daily XP cap reached — come back tomorrow!", { duration: 2000 });
    }
    checkGameAndShowReview();
  }, [isAuthenticated, myReactions, article.id, article.sourceUrl, openAuthModal, refreshFromServer, checkGameAndShowReview]);

  const handleBookmark = useCallback(() => {
    if (!isAuthenticated) { openAuthModal("bookmark", { articleId: article.id }); return; }
    const newState = toggleBookmark(article);
    toast.success(newState ? "Saved to bookmarks" : "Removed from bookmarks");
    if (newState) checkGameAndShowReview();
  }, [isAuthenticated, article, openAuthModal, toggleBookmark, checkGameAndShowReview]);

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

  const awardViewXP = useCallback(async () => {
    if (hasAwardedView) return;
    setHasAwardedView(true);
    const result = await awardXP("read_summary", article.sourceUrl);
    if (result && result.awarded > 0) {
      toast.success(`+${result.awarded} XP`, { duration: 1500 });
      await refreshFromServer();
    } else if (result === null) {
      addXP(XP_VALUES.VIEW_SUMMARY); // guest fallback
    }
  }, [hasAwardedView, article.sourceUrl, addXP, refreshFromServer]);

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

  const handleReadFull = useCallback(async () => {
    const result = await awardXP("read_more", article.sourceUrl);
    if (result && result.awarded > 0) {
      toast.success(`+${result.awarded} XP! Tier ${result.tier}`, { duration: 1500 });
      await refreshFromServer();
    } else if (result?.capped) {
      toast.info("Daily XP cap reached — come back tomorrow!", { duration: 2000 });
    } else if (result === null) {
      // Guest fallback
      addXP(XP_VALUES.READ_FULL_ARTICLE);
    }
  }, [article.sourceUrl, addXP, refreshFromServer]);

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

        {/* Headline — clickable, opens the full article */}
        <h2 className="text-xl font-bold mb-3 leading-tight line-clamp-3">
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleReadFull()}
            className="hover:text-primary transition-colors cursor-pointer"
          >
            {article.title}
          </a>
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
          {QUICK_REACTIONS.map(({ emoji, key, label }) => (
            <button
              key={key}
              onClick={() => handleReaction(emoji)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full transition-colors text-sm",
                myReactions.has(emoji)
                  ? "bg-primary/15 ring-1 ring-primary/40"
                  : "bg-secondary/50 hover:bg-secondary"
              )}
              title={label}
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

          <Button size="sm" className="gap-2" onClick={async () => {
            await handleReadFull();
            window.open(article.sourceUrl, '_blank', 'noopener,noreferrer');
          }}>
            Read Full Article
            <ExternalLink className="h-3 w-3" />
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
