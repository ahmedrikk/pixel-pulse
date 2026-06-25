import { useState, useCallback, useMemo, useEffect } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Comment, COMMENT_CONSTANTS } from "@/types/feed";
import { CommentThread } from "./CommentThread";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { fetchComments, insertComment, updateComment, softDeleteComment } from "@/lib/comments";
import { toast } from "sonner";

type SortMode = "top" | "new" | "hot";

interface EnhancedCommentSectionProps {
  articleId: string;
  initialComments?: Comment[];
  className?: string;
}

// Wilson score for "hot" sorting
function wilsonScore(upvotes: number, total: number): number {
  if (total === 0) return 0;
  const z = 1.96; // 95% confidence
  const phat = upvotes / total;
  const n = total;
  return (
    (phat + z * z / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) /
    (1 + z * z / n)
  );
}

// Recency decay for hot sorting
function recencyDecay(timestamp: string): number {
  const hoursOld = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
  const halfLife = 6; // 6 hour half-life
  return Math.pow(0.5, hoursOld / halfLife);
}

// Build comment tree from flat list
function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const roots: Comment[] = [];

  // First pass: create map
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree
  comments.forEach(comment => {
    const node = commentMap.get(comment.id)!;
    if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
      const parent = commentMap.get(comment.parentCommentId)!;
      if (!parent.replies) parent.replies = [];
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function EnhancedCommentSection({
  articleId,
  initialComments = [],
  className,
}: EnhancedCommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [isExpanded, setIsExpanded] = useState(true);
  const { isAuthenticated, openAuthModal, user } = useAuthGate();

  // Load persisted comments for this article (visible to everyone).
  const reload = useCallback(async () => {
    const rows = await fetchComments(articleId);
    setComments(rows);
  }, [articleId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Sort comments based on mode
  const sortedComments = useMemo(() => {
    const sorted = [...comments];
    
    switch (sortMode) {
      case "top":
        sorted.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
        break;
      case "new":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "hot":
        sorted.sort((a, b) => {
          const scoreA = wilsonScore(a.upvotes, a.upvotes + a.downvotes) * recencyDecay(a.createdAt);
          const scoreB = wilsonScore(b.upvotes, b.upvotes + b.downvotes) * recencyDecay(b.createdAt);
          return scoreB - scoreA;
        });
        break;
    }
    
    return buildCommentTree(sorted);
  }, [comments, sortMode]);

  // Handle vote
  const handleVote = useCallback((commentId: string, type: "up" | "down") => {
    if (!isAuthenticated) {
      openAuthModal("comment", { commentId });
      return;
    }

    setComments(prev => prev.map(comment => {
      if (comment.id !== commentId) return comment;
      
      const currentVote = comment.userVote;
      let { upvotes, downvotes } = comment;
      
      // Remove previous vote
      if (currentVote === "up") upvotes--;
      if (currentVote === "down") downvotes--;
      
      // Add new vote (or toggle off if same)
      if (currentVote !== type) {
        if (type === "up") upvotes++;
        if (type === "down") downvotes++;
      }
      
      return {
        ...comment,
        upvotes,
        downvotes,
        userVote: currentVote === type ? null : type,
      };
    }));
  }, [isAuthenticated, openAuthModal]);

  // Handle reply — persisted to the DB
  const handleReply = useCallback(async (parentId: string, body: string) => {
    if (!isAuthenticated || !user) {
      openAuthModal("comment", { commentId: parentId });
      return;
    }
    const ok = await insertComment(articleId, user.id, body, parentId);
    if (ok) { await reload(); toast.success("Reply posted!"); }
    else toast.error("Couldn't post reply");
  }, [articleId, isAuthenticated, user, openAuthModal, reload]);

  // Handle edit — persisted
  const handleEdit = useCallback(async (commentId: string, body: string) => {
    const ok = await updateComment(commentId, body);
    if (ok) { await reload(); toast.success("Comment updated"); }
  }, [reload]);

  // Handle delete — soft delete, persisted
  const handleDelete = useCallback(async (commentId: string) => {
    const ok = await softDeleteComment(commentId);
    if (ok) { await reload(); toast.success("Comment deleted"); }
  }, [reload]);

  // Handle root comment submit — persisted so others can see it
  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      openAuthModal("comment", { articleId });
      return;
    }

    if (newComment.trim().length < COMMENT_CONSTANTS.MIN_LENGTH) {
      toast.error(`Comment must be at least ${COMMENT_CONSTANTS.MIN_LENGTH} characters`);
      return;
    }

    setIsSubmitting(true);
    const ok = await insertComment(articleId, user.id, newComment.trim());
    setIsSubmitting(false);

    if (ok) {
      setNewComment("");
      await reload();
      toast.success("+25 XP! Comment posted");
    } else {
      toast.error("Couldn't post comment");
    }
  };

  const totalComments = comments.length;

  return (
    <div className={cn("border-t pt-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Comments ({totalComments})</span>
        </button>
        
        {totalComments > 0 && (
          <Tabs value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <TabsList className="h-7">
              <TabsTrigger value="top" className="text-xs px-2">Top</TabsTrigger>
              <TabsTrigger value="new" className="text-xs px-2">New</TabsTrigger>
              <TabsTrigger value="hot" className="text-xs px-2">Hot</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Comment Input */}
      <div className="flex gap-3 mb-4">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={user?.user_metadata?.avatar_url} />
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {(user?.email ?? "G").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder={isAuthenticated ? "Share your thoughts..." : "Sign in to comment"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={!isAuthenticated}
            onClick={() => !isAuthenticated && openAuthModal("comment", { articleId })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                handleSubmit();
              }
            }}
            minLength={COMMENT_CONSTANTS.MIN_LENGTH}
            maxLength={COMMENT_CONSTANTS.MAX_LENGTH}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {newComment.length}/{COMMENT_CONSTANTS.MAX_LENGTH}
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting || newComment.trim().length < COMMENT_CONSTANTS.MIN_LENGTH}
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

      {/* Comments List — grows with content, caps + scrolls past 500px so a
          short thread doesn't leave a big empty gap before anything below. */}
      {isExpanded && (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-4">
            {sortedComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onVote={handleVote}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                currentUserId={user?.id ?? ""}
              />
            ))}

            {sortedComments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet. Be the first!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {!isExpanded && totalComments > 0 && (
        <div className="text-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Show all {totalComments} comments
          </button>
        </div>
      )}
    </div>
  );
}
