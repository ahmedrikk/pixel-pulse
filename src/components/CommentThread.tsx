import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Comment, COMMENT_CONSTANTS } from "@/types/feed";
import { useGatedAction } from "@/contexts/AuthGateContext";
import { toast } from "sonner";

interface CommentThreadProps {
  comment: Comment;
  onVote: (commentId: string, type: "up" | "down") => void;
  onReply: (parentId: string, body: string) => void;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId?: string;
}

export function CommentThread({
  comment,
  onVote,
  onReply,
  onEdit,
  onDelete,
  currentUserId,
}: CommentThreadProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [editBody, setEditBody] = useState(comment.body);
  const [showActions, setShowActions] = useState(false);
  
  const { requireAuth } = useGatedAction();
  const isAuthor = currentUserId === comment.userId;
  const canEdit = isAuthor && !comment.deletedAt && canEditComment(comment.createdAt);
  const canDelete = isAuthor && !comment.deletedAt;

  const score = comment.upvotes - comment.downvotes;
  const hasUserVote = comment.userVote !== undefined;

  const handleVote = useCallback((type: "up" | "down") => {
    if (isAuthor) {
      toast.error("You can't vote on your own comment");
      return;
    }
    onVote(comment.id, type);
  }, [comment.id, comment.userVote, isAuthor, onVote]);

  const handleReply = useCallback(() => {
    if (replyBody.trim().length < COMMENT_CONSTANTS.MIN_LENGTH) {
      toast.error(`Comment must be at least ${COMMENT_CONSTANTS.MIN_LENGTH} characters`);
      return;
    }
    onReply(comment.id, replyBody.trim());
    setReplyBody("");
    setIsReplying(false);
  }, [comment.id, onReply, replyBody]);

  const handleEdit = useCallback(() => {
    if (editBody.trim().length < COMMENT_CONSTANTS.MIN_LENGTH) {
      toast.error(`Comment must be at least ${COMMENT_CONSTANTS.MIN_LENGTH} characters`);
      return;
    }
    onEdit(comment.id, editBody.trim());
    setIsEditing(false);
  }, [comment.id, editBody, onEdit]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (comment.deletedAt) {
    return (
      <div className="py-2 text-sm text-muted-foreground italic">
        [deleted]
      </div>
    );
  }

  return (
    <div className={cn("group", comment.depth > 0 && "ml-4 md:ml-8 border-l-2 border-border pl-4")}>
      {/* Comment Header */}
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={comment.author.avatar} />
          <AvatarFallback className="text-xs">
            {comment.author.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Author Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{comment.author.name}</span>
            {comment.author.tier && comment.author.tier > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Tier {comment.author.tier}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(comment.createdAt)}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>

          {/* Comment Body */}
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="min-h-[80px]"
                maxLength={COMMENT_CONSTANTS.MAX_LENGTH}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-1 leading-relaxed">{comment.body}</p>
          )}

          {/* Actions Row */}
          <div className="flex items-center gap-1 mt-2">
            {/* Vote Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2",
                  comment.userVote === "up" && "text-orange-500 bg-orange-500/10"
                )}
                onClick={() => handleVote("up")}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <span className={cn(
                "text-sm font-medium min-w-[20px] text-center",
                score > 0 ? "text-orange-500" : score < 0 ? "text-blue-500" : "text-muted-foreground"
              )}>
                {score}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2",
                  comment.userVote === "down" && "text-blue-500 bg-blue-500/10"
                )}
                onClick={() => handleVote("down")}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Reply Button */}
            {comment.depth < COMMENT_CONSTANTS.MAX_DEPTH && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                onClick={() => setIsReplying(!isReplying)}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                Reply
              </Button>
            )}

            {/* Collapse Button */}
            {comment.replies && comment.replies.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? "[+]" : "[-]"} {comment.replies.length} replies
              </Button>
            )}

            {/* Author Actions */}
            {isAuthor && (
              <div className="relative ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowActions(!showActions)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                
                {showActions && (
                  <div className="absolute right-0 top-full mt-1 bg-card border rounded-md shadow-lg z-10 min-w-[120px]">
                    {canEdit && (
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                        onClick={() => { setIsEditing(true); setShowActions(false); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-secondary text-red-500 flex items-center gap-2"
                        onClick={() => { onDelete(comment.id); setShowActions(false); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reply Input */}
          {isReplying && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="min-h-[80px]"
                minLength={COMMENT_CONSTANTS.MIN_LENGTH}
                maxLength={COMMENT_CONSTANTS.MAX_LENGTH}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {replyBody.length}/{COMMENT_CONSTANTS.MAX_LENGTH}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsReplying(false)}>
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleReply}
                    disabled={replyBody.trim().length < COMMENT_CONSTANTS.MIN_LENGTH}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Nested Replies */}
          {!isCollapsed && comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map((reply) => (
                <CommentThread
                  key={reply.id}
                  comment={reply}
                  onVote={onVote}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to check if comment can be edited
function canEditComment(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - created) / (1000 * 60);
  return diffMinutes <= COMMENT_CONSTANTS.EDIT_WINDOW_MINUTES;
}
