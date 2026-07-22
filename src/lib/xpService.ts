import { supabase, isDemoMode, DEMO_PROFILE } from "@/integrations/supabase/client";
import { XP_TABLE, XP_PER_TIER } from "./xpConstants";

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

// Demo mode XP tracking (stored in localStorage)
const DEMO_XP_KEY = 'demo_xp_state';

interface DemoXPState {
  xp_today: number;
  xp_season: number;
  xp_lifetime: number;
  tier: number;
  daily_streak: number;
  awarded_actions: Record<string, number>; // Track daily counts per action
}

function getDemoXPState(): DemoXPState {
  const stored = localStorage.getItem(DEMO_XP_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    xp_today: 350,
    xp_season: 12500,
    xp_lifetime: 45200,
    tier: 12,
    daily_streak: 7,
    awarded_actions: {},
  };
}

function saveDemoXPState(state: DemoXPState) {
  localStorage.setItem(DEMO_XP_KEY, JSON.stringify(state));
}

// Demo XP award simulation
async function awardXpDemo(action_type: string, ref_id?: string): Promise<XpResult | null> {
  const state = getDemoXPState();
  const baseXp = XP_TABLE[action_type as keyof typeof XP_TABLE] || 10;
  
  // Check daily caps (simplified)
  const actionCount = state.awarded_actions[action_type] || 0;
  const dailyLimits: Record<string, number> = {
    read_summary: 15,
    read_more: 10,
    article_combo: 2,
    comment: 5,
    react: 10,
    predict_submit: 3,
    scroll_50: 2,
    scroll_90: 1,
  };
  
  if (dailyLimits[action_type] && actionCount >= dailyLimits[action_type]) {
    return {
      awarded: 0,
      xp_today: state.xp_today,
      xp_season: state.xp_season,
      xp_lifetime: state.xp_lifetime,
      tier: state.tier,
      streak_count: state.daily_streak,
      capped: true,
    };
  }
  
  // Award XP
  state.awarded_actions[action_type] = actionCount + 1;
  state.xp_today += baseXp;
  state.xp_season += baseXp;
  state.xp_lifetime += baseXp;
  
  // Check tier up
  const newTier = Math.floor(state.xp_season / XP_PER_TIER);
  const tierUp = newTier > state.tier;
  state.tier = newTier;
  
  saveDemoXPState(state);
  
  return {
    awarded: baseXp,
    xp_today: state.xp_today,
    xp_season: state.xp_season,
    xp_lifetime: state.xp_lifetime,
    tier: state.tier,
    streak_count: state.daily_streak,
    tier_up: tierUp,
  };
}

function dispatchXPGained(result: XpResult, label?: string) {
  if (result.awarded > 0) {
    window.dispatchEvent(
      new CustomEvent("xp-gained", {
        detail: { awarded: result.awarded, label, tier_up: result.tier_up ?? false },
      })
    );
  }
}

async function awardXp(action_type: string, ref_id?: string, label?: string): Promise<XpResult | null> {
  let result: XpResult | null = null;

  if (isDemoMode()) {
    result = await awardXpDemo(action_type, ref_id);
  } else {
    const { data, error } = await supabase.functions.invoke("award-xp", {
      body: { action_type, ref_id },
    });
    if (error) {
      console.error(`XP award failed (${action_type}):`, error);
      return null;
    }
    result = data as XpResult;
  }

  if (result) dispatchXPGained(result, label);
  return result;
}

export const trackArticleRead  = (url: string) => awardXp("read_summary", url, "Article Read");
export const trackReadMore     = (url: string) => awardXp("read_more", url, "Read More");
export const trackArticleCombo = ()            => awardXp("article_combo", undefined, "Article Combo!");
export const claimDailyLogin   = ()            => awardXp("daily_login", undefined, "Daily Login");
export const trackComment      = (url: string) => awardXp("comment", url, "Review Posted");
export const trackReaction     = (url: string, emoji: string) => awardXp("react", `${url}:${emoji}`, "Reaction");
export const trackScroll       = (page: string, depth: 50 | 90) =>
  awardXp(depth === 50 ? "scroll_50" : "scroll_90", page, `${depth}% Read`);

export async function submitPrediction(matchId: number, team: string): Promise<boolean> {
  if (isDemoMode()) {
    return true;
  }
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("No user logged in");
    return false;
  }
  
  // One prediction per match.
  // The predictions_user_id_match_id_key unique constraint backstops races.
  const { data: existing } = await supabase
    .from("predictions")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase.from("predictions").insert({
    user_id: user.id,
    match_id: matchId,
    predicted_team: team,
    xp_participation: 0,
  });
  if (error) {
    if ((error as { code?: string }).code === "23505") return false; // raced a duplicate
    console.error("Prediction insert failed:", error);
    return false;
  }
  return true;
}

// Get current XP for components
export function getDemoXP(): { xp_today: number; xp_season: number; tier: number; daily_streak: number } {
  if (!isDemoMode()) {
    return { xp_today: 0, xp_season: 0, tier: 0, daily_streak: 0 };
  }
  const state = getDemoXPState();
  return {
    xp_today: state.xp_today,
    xp_season: state.xp_season,
    tier: state.tier,
    daily_streak: state.daily_streak,
  };
}
