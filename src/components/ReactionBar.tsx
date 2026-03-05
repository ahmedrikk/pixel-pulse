import { useState, useCallback } from "react";
import { Heart, ThumbsUp, Laugh, Frown, Rocket, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackReaction } from "@/lib/xpService";
import { toast } from "sonner";

interface ReactionBarProps {
  contentId: string;
  contentType: "article" | "comment";
  initialReactions?: Record<string, number>;
  userReaction?: string | null;
  className?: string;
  compact?: boolean;
}

const REACTIONS = [
  { emoji: "❤️", key: "heart", icon: Heart, label: "Love", color: "text-red-500" },
  { emoji: "👍", key: "thumbsup", icon: ThumbsUp, label: "Like", color: "text-blue-500" },
  { emoji: "😂", key: "laugh", icon: Laugh, label: "Funny", color: "text-yellow-500" },
  { emoji: "⚡", key: "wow", icon: Zap, label: "Wow", color: "text-purple-500" },
  { emoji: "😢", key: "sad", icon: Frown, label: "Sad", color: "text-cyan-500" },
  { emoji: "🚀", key: "rocket", icon: Rocket, label: "Fire", color: "text-orange-500" },
] as const;

export function ReactionBar({
  contentId,
  contentType,
  initialReactions = {},
  userReaction = null,
  className,
  compact = false,
}: ReactionBarProps) {
  const [reactions, setReactions] = useState<Record<string, number>>(initialReactions);
  const [selected, setSelected] = useState<string | null>(userReaction);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReaction = useCallback(
    async (reactionKey: string, emoji: string) => {
      if (isSubmitting) return;
      
      // Toggle off if already selected
      if (selected === reactionKey) {
        setSelected(null);
        setReactions((prev) => ({
          ...prev,
          [reactionKey]: Math.max(0, (prev[reactionKey] || 0) - 1),
        }));
        return;
      }

      setIsSubmitting(true);

      // Optimistic update
      setSelected(reactionKey);
      setReactions((prev) => ({
        ...prev,
        [reactionKey]: (prev[reactionKey] || 0) + 1,
        ...(selected && { [selected]: Math.max(0, (prev[selected] || 0) - 1) }),
      }));

      // Award XP
      const result = await trackReaction(`${contentType}:${contentId}`, emoji);
      
      if (result?.capped) {
        toast.info("Daily reaction XP cap reached!", {
          description: "Come back tomorrow for more XP",
        });
      } else if (result?.awarded) {
        toast.success(`+${result.awarded} XP!`, {
          description: "Thanks for your reaction!",
          duration: 1500,
        });
      }

      setIsSubmitting(false);
    },
    [contentId, contentType, isSubmitting, selected]
  );

  if (compact) {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {REACTIONS.slice(0, 3).map(({ emoji, key, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => handleReaction(key, emoji)}
            disabled={isSubmitting}
            className={cn(
              "relative p-1.5 rounded-md transition-all duration-200",
              selected === key
                ? "bg-primary/20 scale-110"
                : "hover:bg-secondary hover:scale-105",
              isSubmitting && "opacity-50 cursor-not-allowed"
            )}
            title={key}
          >
            <Icon className={cn("h-3.5 w-3.5", selected === key ? color : "text-muted-foreground")} />
            {reactions[key] > 0 && (
              <span className="absolute -top-1 -right-1 text-[9px] font-medium bg-background border rounded-full px-1">
                {reactions[key]}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {REACTIONS.map(({ emoji, key, icon: Icon, label, color }) => (
        <button
          key={key}
          onClick={() => handleReaction(key, emoji)}
          disabled={isSubmitting}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-all duration-200 border",
            selected === key
              ? cn("bg-primary/10 border-primary/30", color)
              : "bg-secondary/50 border-transparent hover:bg-secondary hover:border-border",
            isSubmitting && "opacity-50 cursor-not-allowed"
          )}
        >
          <Icon className={cn("h-4 w-4", selected === key ? color : "text-muted-foreground")} />
          <span className="text-xs font-medium">{label}</span>
          {reactions[key] > 0 && (
            <span className="text-xs text-muted-foreground">
              {reactions[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
