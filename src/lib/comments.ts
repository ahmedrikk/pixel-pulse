import { supabase } from "@/integrations/supabase/client";
import { Comment } from "@/types/feed";

interface CommentRow {
  id: string;
  article_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

type ProfileLite = { username: string | null; avatar_url: string | null };

function mapRow(r: CommentRow, profiles: Map<string, ProfileLite>): Comment {
  const p = profiles.get(r.user_id);
  return {
    id: r.id,
    articleId: r.article_id,
    userId: r.user_id,
    parentCommentId: r.parent_comment_id,
    body: r.deleted_at ? "[deleted]" : r.body,
    depth: r.parent_comment_id ? 1 : 0,
    upvotes: 0,
    downvotes: 0,
    score: 0,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
    author: {
      name: p?.username ?? "Gamer",
      avatar: p?.avatar_url ?? undefined,
      tier: 1,
    },
    userVote: null,
  };
}

/**
 * All comments for an article, oldest-first. We fetch authors in a second
 * query (keyed by user_id) rather than a PostgREST embed, since article_comments
 * references auth.users — not profiles — so the embed relationship is ambiguous.
 */
export async function fetchComments(articleId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("article_comments")
    .select("id, article_id, user_id, parent_comment_id, body, created_at, edited_at, deleted_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  const rows = data as unknown as CommentRow[];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profiles = new Map<string, ProfileLite>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (profs ?? []) as any[]) {
      profiles.set(p.id, { username: p.username, avatar_url: p.avatar_url });
    }
  }

  return rows.map((r) => mapRow(r, profiles));
}

export async function insertComment(
  articleId: string,
  userId: string,
  body: string,
  parentCommentId: string | null = null
): Promise<boolean> {
  const { error } = await supabase.from("article_comments").insert({
    article_id: articleId,
    user_id: userId,
    body,
    parent_comment_id: parentCommentId,
  });
  if (error) console.error("insertComment error:", error);
  return !error;
}

export async function updateComment(id: string, body: string): Promise<boolean> {
  const { error } = await supabase
    .from("article_comments")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function softDeleteComment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("article_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}
