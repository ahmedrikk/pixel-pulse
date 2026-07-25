import { supabase } from "@/integrations/supabase/client";

const TRACKING_KEY = "talus-feed-tracking-id";

export function getFeedTrackingId(): string {
  try {
    const existing = window.localStorage.getItem(TRACKING_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(TRACKING_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export async function recordArticleDwell(articleId: string, seconds: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds < 1) return;
  const { error } = await supabase.rpc("record_article_dwell", {
    p_tracking_id: getFeedTrackingId(),
    p_article_id: articleId,
    p_seconds: Math.min(Math.round(seconds * 10) / 10, 300),
  });
  if (error) throw error;
}
export async function recordFeedEngagement(
  articleId: string,
  eventType: "read_full" | "vote" | "comment" | "share",
): Promise<void> {
  const { error } = await supabase.rpc("record_feed_engagement", {
    p_tracking_id: getFeedTrackingId(),
    p_article_id: articleId,
    p_event_type: eventType,
  });
  if (error) throw error;
}
