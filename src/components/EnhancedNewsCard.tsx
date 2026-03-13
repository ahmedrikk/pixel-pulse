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
  ChevronDown,
  ChevronUp,
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
  { emoji: "👍", key: "thumbsup" },
  { emoji: "🔥", key: "fire" },
  { emoji: "😮", key: "wow" },
];

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normaliseSummary(summary: string): string {
  if (!summary) return "";
  if (summary.length <= 280) return summary;
  const cut = summary.substring(0, 279);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 200 ? cut.substring(0, lastSpace) : cut) + "…";
}

// Source name → short colour-coded abbreviation for the source dot
const SOURCE_COLORS: Record<string, string> = {
  ign: "bg-red-500",
  gamespot: "bg-yellow-500",
  kotaku: "bg-pink-500",
  "pc gamer": "bg-blue-500",
  eurogamer: "bg-orange-500",
  polygon: "bg-purple-500",
  "rock paper shotgun": "bg-green-500",
  vg247: "bg-cyan-500",
  "game rant": "bg-indigo-500",
};

function sourceColor(sourceName: string): string {
  return SOURCE_COLORS[sourceName.toLowerCase()] ?? "bg-primary";
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
  const [imgError, setImgError] = useState(false);

  const cardRef = useRef<HTMLElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);
  const hasTriggeredViewRef = useRef(false);

  const isCurrentlyBookmarked = isBookmarked(article.id);

  const handleTagClick = (tag: string) => setActiveTag(tag);

  const handleLike = useCallback(() => {
    if (!isAuthenticated) { openAuthModal("like", { articleId: article.id }); return; }
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    if (!liked) { addXP(XP_VALUES.REACT); toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 }); }
  }, [isAuthenticated, liked, likeCount, article.id, openAuthModal, addXP]);

  const handleReaction = useCallback((emoji: string) => {
    if (!isAuthenticated) { openAuthModal("react", { articleId: article.id }); return; }
    setUserReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    addXP(XP_VALUES.REACT);
    toast.success(`+${XP_VALUES.REACT} XP!`, { duration: 1500 });
  }, [isAuthenticated, article.id, openAuthModal, addXP]);

  const handleBookmark = useCallback(() => {
    if (!isAuthenticated) { openAuthModal("bookmark", { articleId: article.id }); return; }
    const newState = toggleBookmark(article);
    toast.success(newState ? "Saved to bookmarks" : "Removed from bookmarks");
  }, [isAuthenticated, article, openAuthModal, toggleBookmark]);

  const handleShare = useCallback(async (type: "copy" | "twitter" | "whatsapp") => {
    const url = article.sourceUrl;
    const text = `Check out: ${article.title}`;
    if (type === "copy") { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    else if (type === "twitter") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
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
              dwellTimerRef.current = setTimeout(awardViewXP, 5000);
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

  const summaryText = normaliseSummary(article.summary);
  const displayTags = article.topicTags.filter(isSpecificTag).slice(0, 3);
  const dotColor = sourceColor(article.sourceName);

  return (
    <article
      ref={cardRef}
      className="group bg-card border rounded-xl overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
    >
      {/* Main row: thumbnail + content */}
      <div className="flex gap-0">
        {/* Thumbnail */}
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleReadFull}
          className="relative flex-shrink-0 w-36 sm:w-44 overflow-hidden"
          tabIndex={-1}
        >
          {!imgError ? (
            <img
              src={article.heroImageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-2xl opacity-30">🎮</span>
            </div>
          )}
        </a>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0 p-3 gap-1.5">
          {/* Source row */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)} />
            <span className="font-semibold text-foreground/80 truncate">{article.sourceName}</span>
            <span className="opacity-40">·</span>
            <span className="flex-shrink-0">{formatDate(article.publishedAt)}</span>
            {displayTags[0] && (
              <>
                <span className="opacity-40 ml-auto">·</span>
                <button
                  onClick={() => handleTagClick(displayTags[0])}
                  className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-colors flex-shrink-0"
                >
                  #{displayTags[0]}
                </button>
              </>
            )}
          </div>

          {/* Title */}
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReadFull}
            className="block"
          >
            <h2 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {article.title}
            </h2>
          </a>

          {/* Summary */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {summaryText}
          </p>

          {/* Bottom row: actions */}
          <div className="flex items-center gap-0.5 mt-0.5 -mx-1">
            {/* Reactions */}
            {QUICK_REACTIONS.map(({ emoji, key }) => (
              <button
                key={key}
                onClick={() => handleReaction(emoji)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs hover:bg-secondary/80 transition-colors"
                title={key}
              >
                <span className="text-sm leading-none">{emoji}</span>
                {userReactions[emoji] > 0 && (
                  <span className="text-[10px] text-muted-foreground">{userReactions[emoji]}</span>
                )}
              </button>
            ))}

            <div className="w-px h-3 bg-border mx-1" />

            {/* Like */}
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs transition-colors",
                liked ? "text-red-500" : "text-muted-foreground hover:text-red-500 hover:bg-secondary/80"
              )}
            >
              <Heart className={cn("h-3 w-3", liked && "fill-current")} />
              <span>{likeCount}</span>
            </button>

            {/* Comments */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
            >
              <MessageCircle className="h-3 w-3" />
              <span>{article.comments}</span>
            </button>

            {/* Bookmark */}
            <button
              onClick={handleBookmark}
              className={cn(
                "px-1.5 py-0.5 rounded text-xs transition-colors",
                isCurrentlyBookmarked
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary hover:bg-secondary/80"
              )}
            >
              <Bookmark className={cn("h-3 w-3", isCurrentlyBookmarked && "fill-current")} />
            </button>

            {/* Share */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors">
                  <Share2 className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => handleShare("copy")}>
                  <Link2 className="h-3.5 w-3.5 mr-2" /> Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare("twitter")}>
                  <Twitter className="h-3.5 w-3.5 mr-2" /> Share on X
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
                  <MessageSquare className="h-3.5 w-3.5 mr-2" /> WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Extra tags (collapsed) */}
            {displayTags.length > 1 && (
              <div className="flex items-center gap-1 ml-auto">
                {displayTags.slice(1).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Read link */}
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleReadFull}
              className="ml-auto flex items-center gap-0.5 px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary hover:text-primary-foreground transition-colors flex-shrink-0"
            >
              Read <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t px-3 pb-3">
          <EnhancedCommentSection articleId={article.id} className="mt-3" />
        </div>
      )}
    </article>
  );
}
