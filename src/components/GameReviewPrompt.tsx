import { useState, useEffect, useCallback } from "react";
import { Star, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GameReview, XP_VALUES } from "@/types/feed";
import { useXP } from "@/contexts/XPContext";
import { toast } from "sonner";

interface GameReviewPromptProps {
  articleId: string;
  gameId: string;
  gameName: string;
  gameCoverUrl: string;
  isVisible: boolean;
  onDismiss: () => void;
  onSubmit: (review: Omit<GameReview, "id" | "userId" | "createdAt">) => void;
}

const REVIEW_TAGS = [
  { id: "fun", label: "Fun", positive: true },
  { id: "challenging", label: "Challenging", positive: true },
  { id: "beautiful", label: "Beautiful", positive: true },
  { id: "must-play", label: "Must-Play", positive: true },
  { id: "repetitive", label: "Repetitive", positive: false },
  { id: "skip-it", label: "Skip It", positive: false },
];

export function GameReviewPrompt({
  gameId,
  gameName,
  gameCoverUrl,
  isVisible,
  onDismiss,
  onSubmit,
}: GameReviewPromptProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { addXP } = useXP();

  // Delay showing the prompt
  const [showPrompt, setShowPrompt] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }

    onSubmit({
      gameId,
      starRating: rating,
      reviewText: reviewText.trim() || null,
      tags: selectedTags,
      helpfulVotes: 0,
      source: "feed_prompt",
    });

    // Award XP
    const xpAmount = reviewText.trim().length > 0 
      ? XP_VALUES.REVIEW_WITH_TEXT 
      : XP_VALUES.REVIEW_RATING_ONLY;
    
    addXP(xpAmount);
    setIsSubmitted(true);
    
    toast.success(`+${xpAmount} XP! Review posted`, {
      description: "Thanks for sharing your thoughts!",
    });

    // Auto dismiss after showing success
    setTimeout(() => {
      onDismiss();
    }, 2000);
  }, [rating, reviewText, selectedTags, gameId, onSubmit, addXP, onDismiss]);

  if (!showPrompt || isSubmitted) {
    if (isSubmitted) {
      return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="font-semibold text-primary">Review posted!</p>
          <p className="text-sm text-muted-foreground">Thanks for sharing</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-card border rounded-xl p-5 mt-4 animate-in slide-in-from-bottom-2">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <img
          src={gameCoverUrl}
          alt={gameName}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">
            You read about this game — have you played it?
          </p>
          <h4 className="font-bold">Rate {gameName}</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Star Rating */}
      <div className="mb-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "h-8 w-8 transition-colors",
                  (hoverRating ? star <= hoverRating : star <= rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {rating > 0 && ["Terrible", "Bad", "Okay", "Good", "Excellent"][rating - 1]}
        </p>
      </div>

      {/* Review Text (Optional) */}
      <div className="mb-4">
        <Textarea
          placeholder="Leave a review (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          className="min-h-[80px] resize-none"
          maxLength={500}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {reviewText.length}/500
          </span>
          {reviewText.length > 0 && (
            <span className="text-xs text-green-500 font-medium">
              +{XP_VALUES.REVIEW_WITH_TEXT - XP_VALUES.REVIEW_RATING_ONLY} bonus XP
            </span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Select tags:</p>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleTagToggle(tag.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                selectedTags.includes(tag.id)
                  ? tag.positive
                    ? "bg-green-500/20 text-green-600 border border-green-500/30"
                    : "bg-red-500/20 text-red-600 border border-red-500/30"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onDismiss}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Maybe later
        </button>
        <Button 
          onClick={handleSubmit}
          disabled={rating === 0}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Post Review
        </Button>
      </div>
    </div>
  );
}
