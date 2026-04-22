import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, Share2, Bookmark, MessageCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsItem } from "@/data/mockNews";
import { useTagFilter } from "@/contexts/TagFilterContext";
import { trackArticleRead, trackReadMore, trackArticleCombo } from "@/lib/xpService";
import { ReactionBar } from "./ReactionBar";
import { CommentSection } from "./CommentSection";
import { toast } from "sonner";
import { ARTICLE_DWELL_TIME } from "@/lib/xpConstants";

interface NewsCardProps {
  news: NewsItem;
  articleNumber?: number; // For tracking combo (3+ articles)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsCard({ news, articleNumber = 0 }: NewsCardProps) {
  const { setActiveTag } = useTagFilter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(news.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [hasAwardedRead, setHasAwardedRead] = useState(false);
  const [hasAwardedCombo, setHasAwardedCombo] = useState(false);
  
  const cardRef = useRef<HTMLElement>(null);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
  };

  // Track article read (dwell time)
  const awardReadXP = useCallback(async () => {
    if (hasAwardedRead) return;
    
    const result = await trackArticleRead(news.sourceUrl);
    if (result?.awarded) {
      setHasAwardedRead(true);
      toast.success(`+${result.awarded} XP!`, {
        description: "Thanks for reading!",
        duration: 1500,
      });
    }
  }, [hasAwardedRead, news.sourceUrl]);

  // Track combo bonus (3+ articles)
  const awardComboXP = useCallback(async () => {
    if (hasAwardedCombo || articleNumber < 3) return;
    
    const result = await trackArticleCombo();
    if (result?.awarded) {
      setHasAwardedCombo(true);
      toast.success(`+${result.awarded} XP Combo Bonus!`, {
        description: "3+ articles read!",
        duration: 2000,
      });
    }
  }, [hasAwardedCombo, articleNumber]);

  // Handle Read More click
  const handleReadMore = async (e: React.MouseEvent) => {
    // Award Read More XP
    const result = await trackReadMore(news.sourceUrl);
    if (result?.awarded) {
      toast.success(`+${result.awarded} XP!`, {
        description: "Enjoy the full article!",
        duration: 1500,
      });
    }
    
    // Award combo if applicable
    await awardComboXP();
  };

  // Intersection Observer for dwell time tracking
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Card is visible - start dwell timer
            if (!isVisibleRef.current && !hasAwardedRead) {
              isVisibleRef.current = true;
              dwellTimerRef.current = setTimeout(() => {
                awardReadXP();
              }, ARTICLE_DWELL_TIME);
            }
          } else {
            // Card is not visible - cancel timer
            isVisibleRef.current = false;
            if (dwellTimerRef.current) {
              clearTimeout(dwellTimerRef.current);
              dwellTimerRef.current = null;
            }
          }
        });
      },
      {
        threshold: 0.5, // 50% of card must be visible
      }
    );

    observer.observe(card);

    return () => {
      observer.disconnect();
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, [awardReadXP, hasAwardedRead]);

  // Show top 4 tags
  const displayTags = news.tags.slice(0, 4);

  return (
    <article
      ref={cardRef}
      className="bg-card rounded-lg border overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-200 group"
    >
      {/* Cover Image */}
      {news.imageUrl ? (
        <div className="relative aspect-video overflow-hidden">
          <img
            src={news.imageUrl}
            alt={news.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-tag text-tag-foreground text-xs font-semibold">
            #{news.category}
          </span>
        </div>
      ) : (
        <div className="relative aspect-video overflow-hidden bg-secondary flex items-center justify-center">
          <span className="px-2 py-1 rounded-md bg-tag text-tag-foreground text-xs font-semibold">
            #{news.category}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Metadata */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{news.source}</span>
          <span>•</span>
          <span>{formatDate(news.timestamp)}</span>
          <span>•</span>
          <span>by {news.author}</span>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
          {news.title}
        </h2>

        {/* Summary - Full display */}
        <p className="text-muted-foreground mb-4 leading-relaxed whitespace-normal break-words">
          {news.summary}
        </p>

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

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`gap-1 ${liked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}`}
              onClick={handleLike}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              <span className="text-xs">{likeCount}</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 text-muted-foreground hover:text-primary"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{news.comments || 0}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          <Button asChild size="sm" className="gap-2" onClick={handleReadMore}>
            <a href={news.sourceUrl} target="_blank" rel="noopener noreferrer">
              Read Full Article
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>

        {/* Reaction Bar */}
        <div className="pt-3 mt-3 border-t">
          <ReactionBar
            contentId={news.id}
            contentType="article"
            compact
          />
        </div>

        {/* Comments Section */}
        {showComments && (
          <CommentSection
            articleId={news.id}
            className="mt-4"
          />
        )}
      </div>
    </article>
  );
}
