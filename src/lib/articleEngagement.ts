import { supabase } from "@/integrations/supabase/client";

export type ArticleVote = "up" | "down" | null;

export interface ArticleEngagement {
  articleId: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  shares: number;
  userVote: ArticleVote;
}

interface EngagementRow {
  article_id: string;
  upvotes: number | string;
  downvotes: number | string;
  comments: number | string;
  shares: number | string;
  user_vote: number | null;
}

function mapEngagement(row: EngagementRow): ArticleEngagement {
  return {
    articleId: row.article_id,
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0,
    comments: Number(row.comments) || 0,
    shares: Number(row.shares) || 0,
    userVote: row.user_vote === 1 ? "up" : row.user_vote === -1 ? "down" : null,
  };
}

export async function fetchArticleEngagement(articleIds: string[]): Promise<ArticleEngagement[]> {
  if (articleIds.length === 0) return [];
  const { data, error } = await supabase.rpc("get_article_engagement", {
    p_article_ids: articleIds,
  });
  if (error) throw error;
  return ((data ?? []) as EngagementRow[]).map(mapEngagement);
}

export async function saveArticleVote(
  articleId: string,
  vote: ArticleVote,
): Promise<ArticleEngagement> {
  const { data, error } = await supabase.rpc("set_article_vote", {
    p_article_id: articleId,
    p_vote: vote === "up" ? 1 : vote === "down" ? -1 : 0,
  });
  if (error) throw error;
  const row = (data as EngagementRow[] | null)?.[0];
  if (!row) throw new Error("Vote was saved but engagement could not be refreshed");
  return mapEngagement(row);
}

function getShareSessionId(): string {
  const storageKey = "talus-share-session";
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export async function recordArticleShare(
  articleId: string,
  shareType: "copy" | "twitter" | "whatsapp",
): Promise<void> {
  const { error } = await supabase.rpc("record_article_share", {
    p_article_id: articleId,
    p_share_type: shareType,
    p_session_id: getShareSessionId(),
  });
  if (error) throw error;
}

