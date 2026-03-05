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

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
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

async function awardXp(action_type: string, ref_id?: string): Promise<XpResult | null> {
  if (isDemoMode()) {
    return awardXpDemo(action_type, ref_id);
  }
  
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
  if (isDemoMode()) {
    return awardXpDemo("predict_submit", String(matchId));
  }
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("No user logged in");
    return null;
  }
  
  const { error } = await supabase.from("predictions").insert({
    user_id: user.id,
    match_id: matchId,
    predicted_team: team,
    xp_participation: 20,
  });
  if (error) {
    console.error("Prediction insert failed:", error);
    return null;
  }
  return awardXp("predict_submit", String(matchId));
}

// Demo trivia questions
const DEMO_TRIVIA: TriviaQuestion[] = [
  {
    id: "demo-1",
    question: "Which game is known for the phrase 'The cake is a lie'?",
    options: ["Half-Life 2", "Portal", "Team Fortress 2", "Left 4 Dead"],
    topic: "gaming_history",
  },
  {
    id: "demo-2",
    question: "What year was the original PlayStation released in North America?",
    options: ["1993", "1994", "1995", "1996"],
    topic: "gaming_history",
  },
  {
    id: "demo-3",
    question: "Which company developed the game 'Elden Ring'?",
    options: ["Capcom", "FromSoftware", "Naughty Dog", "CD Projekt Red"],
    topic: "developers",
  },
];

export async function getTodayTrivia(): Promise<{ questions: TriviaQuestion[]; already_completed: boolean } | null> {
  if (isDemoMode()) {
    const completed = localStorage.getItem('demo_trivia_completed') === new Date().toDateString();
    return {
      questions: DEMO_TRIVIA,
      already_completed: completed,
    };
  }
  
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
  if (isDemoMode()) {
    // Calculate score
    const correctAnswers = [1, 2, 1]; // Correct indices for demo questions
    let score = 0;
    const results = answers.map((answer, idx) => {
      const correct = answer === correctAnswers[idx];
      if (correct) score++;
      return { correct, correct_index: correctAnswers[idx] };
    });
    
    // Calculate XP
    const baseXp = score * 10; // 10 XP per correct
    const perfectBonus = score === 3 ? 75 : 0;
    const totalXp = baseXp + perfectBonus;
    
    // Award XP
    const state = getDemoXPState();
    state.xp_today += totalXp;
    state.xp_season += totalXp;
    state.xp_lifetime += totalXp;
    saveDemoXPState(state);
    
    localStorage.setItem('demo_trivia_completed', new Date().toDateString());
    
    return {
      score,
      total: 3,
      xp_awarded: totalXp,
      results,
    };
  }
  
  const { data, error } = await supabase.functions.invoke("submit-trivia", { body: { answers } });
  if (error) {
    console.error("Trivia submit failed:", error);
    return null;
  }
  return data;
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
