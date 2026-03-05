import { useState, useRef, useCallback } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trackComment } from "@/lib/xpService";
import { toast } from "sonner";
import { ReactionBar } from "./ReactionBar";
import { COMMENT_COOLDOWN } from "@/lib/xpConstants";

interface Comment {
  id: string;
  author: {
    name: string;
    avatar?: string;
    tier?: number;
  };
  content: string;
  timestamp: string;
  likes: number;
  reactions?: Record<string, number>;
  userReaction?: string | null;
}

interface CommentSectionProps {
  articleId: string;
  initialComments?: Comment[];
  className?: string;
}

export function CommentSection({
  articleId,
  initialComments = [],
  className,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const lastCommentTime = useRef<number>(0);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || isSubmitting) return;

    // Check cooldown
    const now = Date.now();
    const timeSinceLastComment = now - lastCommentTime.current;
    if (timeSinceLastComment < COMMENT_COOLDOWN) {
      const remainingSeconds = Math.ceil((COMMENT_COOLDOWN - timeSinceLastComment) / 1000);
      toast.error(`Please wait ${remainingSeconds} seconds before commenting again`);
      return;
    }

    setIsSubmitting(true);

    // Optimistic update
    const tempComment: Comment = {
      id: `temp-${Date.now()}`,
      author: {
        name: "You",
        tier: 1,
      },
      content: newComment.trim(),
      timestamp: "Just now",
      likes: 0,
      reactions: {},
    };

    setComments((prev) => [tempComment, ...prev]);
    setNewComment("");

    // Award XP
    const result = await trackComment(articleId);

    if (result?.capped) {
      toast.info("Daily comment XP cap reached!", {
        description: "You can still comment, but no more XP today",
      });
    } else if (result?.awarded) {
      toast.success(`+${result.awarded} XP!`, {
        description: "Thanks for commenting!",
        duration: 1500,
      });
    }

    lastCommentTime.current = Date.now();
    setIsSubmitting(false);
  }, [articleId, newComment, isSubmitting]);

  const formatTimestamp = (timestamp: string) => {
    if (timestamp === "Just now") return timestamp;
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className={cn("border-t pt-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Comments ({comments.length})</span>
        </button>
      </div>

      {/* Comment Input */}
      <div className="flex gap-3 mb-4">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src="" />
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            You
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                handleSubmit();
              }
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {newComment.length}/500 characters
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
              className="gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Comment
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {isExpanded && (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={comment.author.avatar} />
                  <AvatarFallback className="text-xs">
                    {comment.author.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{comment.author.name}</span>
                    {comment.author.tier && comment.author.tier > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Tier {comment.author.tier}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(comment.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <ReactionBar
                      contentId={comment.id}
                      contentType="comment"
                      initialReactions={comment.reactions}
                      userReaction={comment.userReaction}
                      compact
                    />
                  </div>
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet. Be the first!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {!isExpanded && comments.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Show all {comments.length} comments
          </button>
        </div>
      )}
    </div>
  );
}
