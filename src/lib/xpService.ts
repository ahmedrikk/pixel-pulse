import { supabase } from "@/integrations/supabase/client";

export interface XpResult {
  awarded: number;
  xp_today: number;
  xp_season: number;
  xp_lifetime: number;
  tier: number;
  streak_count: number;
  tier_up?: boolean;
  duplicate?: boolean;
  capped?: boolean;
}

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
}

async function awardXp(action_type: string, ref_id?: string): Promise<XpResult | null> {
  const { data, error } = await supabase.functions.invoke("award-xp", {
    body: { action_type, ref_id },
  });
  if (error) {
    console.error(`XP award failed (${action_type}):`, error);
    return null;
  }
  return data as XpResult;
}

export const trackArticleRead  = (url: string) => awardXp("read_summary", url);
export const trackReadMore     = (url: string) => awardXp("read_more", url);
export const trackArticleCombo = ()            => awardXp("article_combo");
export const claimDailyLogin   = ()            => awardXp("daily_login");
export const trackComment      = (url: string) => awardXp("comment", url);
export const trackReaction     = (url: string, emoji: string) => awardXp("react", `${url}:${emoji}`);
export const trackScroll       = (page: string, depth: 50 | 90) =>
  awardXp(depth === 50 ? "scroll_50" : "scroll_90", page);

export async function submitPrediction(matchId: number, team: string): Promise<XpResult | null> {
  const { error } = await supabase.from("predictions").insert({
    match_id: matchId,
    predicted_team: team,
    xp_participation: 25,
  });
  if (error) {
    console.error("Prediction insert failed:", error);
    return null;
  }
  return awardXp("predict_submit", String(matchId));
}

export async function getTodayTrivia(): Promise<{ questions: TriviaQuestion[]; already_completed: boolean } | null> {
  const { data, error } = await supabase.functions.invoke("generate-trivia", { body: {} });
  if (error) {
    console.error("Trivia fetch failed:", error);
    return null;
  }
  return data;
}

export async function submitTrivia(
  answers: number[]
): Promise<{ score: number; total: number; xp_awarded: number; results: { correct: boolean; correct_index: number }[] } | null> {
  const { data, error } = await supabase.functions.invoke("submit-trivia", { body: { answers } });
  if (error) {
    console.error("Trivia submit failed:", error);
    return null;
  }
  return data;
}
