import type { Comment } from "@/types/feed";

export function makeComment(id: string, changes: Partial<Comment> = {}): Comment {
  return {
    id, articleId: "article", userId: `user-${id}`, parentCommentId: null,
    body: `Message ${id}`, depth: 0, upvotes: 0, downvotes: 0, score: 0,
    createdAt: "2026-11-09T20:00:00Z", editedAt: null, deletedAt: null,
    author: { name: `author_${id}`, tier: 1 }, userVote: null,
    ...changes,
  };
}
