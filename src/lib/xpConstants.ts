// src/lib/xpConstants.ts
// XP System Constants - Aligned with GamePulse Battle Pass Algorithm v2.0

const XP_TABLE_DATA = {
  // Priority 1: Core Reading Actions
  read_summary:        10,  // Max 15/day = 150 XP
  read_more:           35,  // Max 10/day = 350 XP
  article_combo:       50,  // Max 2/day = 100 XP (3+ articles read)
  
  // Priority 2: Loyalty
  daily_login:         25,  // No limit
  streak_7:            150, // Bonus (bypasses daily cap)
  streak_30:           500, // Bonus (bypasses daily cap)
  
  // Priority 3: Knowledge (Trivia)
  trivia_correct:      10,  // Max 3 questions/day = 30 XP
  trivia_perfect:      75,  // Max 1/day (all 3 correct)
  trivia_speed:        50,  // Max 1/day (under 30 seconds)
  
  // Priority 4: Predictions
  predict_submit:      20,  // Max 3/day = 60 XP
  predict_correct:     65,  // Max 3/day = 195 XP
  
  // Priority 5: Social
  comment:             15,  // Max 5/day = 75 XP
  react:               5,   // Max 10/day = 50 XP
  
  // Priority 6: Passive (Scroll)
  scroll_50:           10,  // Max 2/day = 20 XP
  scroll_90:           20,  // Max 1/day = 20 XP
} as const;

export type XpActionType = keyof typeof XP_TABLE_DATA;
export const XP_TABLE: Record<XpActionType, number> = XP_TABLE_DATA;

// Daily Limits per Action Type
export const DAILY_LIMITS: Partial<Record<XpActionType, number>> = {
  read_summary: 15,
  read_more: 10,
  article_combo: 2,
  trivia_correct: 3,
  trivia_perfect: 1,
  trivia_speed: 1,
  predict_submit: 3,
  predict_correct: 3,
  comment: 5,
  react: 10,
  scroll_50: 2,
  scroll_90: 1,
};

export const DAILY_CAP = 400;
export const XP_PER_TIER = 1000;
export const MAX_TIERS = 25;
export const ONBOARDING_DAYS = 3;
export const ONBOARDING_MULTIPLIER = 1.5;
export const ACTIVE_DAY_THRESHOLD = 50;

// Anti-abuse timings (in milliseconds)
export const ARTICLE_DWELL_TIME = 5000; // 5 seconds
export const COMMENT_COOLDOWN = 60000;  // 60 seconds

// Streak bonuses bypass the daily cap
const STREAK_BYPASS_ACTIONS = new Set(["streak_7", "streak_30"]);

export function isStreakBypassAction(action: string): boolean {
  return STREAK_BYPASS_ACTIONS.has(action);
}

// Core actions that get streak multiplier
const CORE_ACTIONS = new Set<XpActionType>(["read_summary", "read_more"]);

export function isCoreAction(action: string): boolean {
  return CORE_ACTIONS.has(action as XpActionType);
}

// Streak multiplier: 1.0x (days 1-6), 1.5x (days 7-14), 2.0x (day 30+)
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 7)  return 1.5;
  return 1.0;
}

export type RewardType = "badge" | "title" | "coupon" | "frame" | "cosmetic" | "bundle";
export type TierReward = { type: RewardType; value: string; label: string; description?: string };

// 25 Tiers organized into 5 Acts
export const ACT_NAMES: Record<number, string> = {
  1: "Act I: The Awakening",
  2: "Act II: Rising Stakes",
  3: "Act III: Mid-Season Mayhem",
  4: "Act IV: Playoffs Approach",
  5: "Act V: Championship",
};

export function getActForTier(tier: number): number {
  if (tier <= 5) return 1;
  if (tier <= 10) return 2;
  if (tier <= 15) return 3;
  if (tier <= 20) return 4;
  return 5;
}

export function getActName(tier: number): string {
  return ACT_NAMES[getActForTier(tier)];
}

// Star tiers are milestones (5, 10, 15, 20, 25)
export function isStarTier(tier: number): boolean {
  return tier % 5 === 0;
}

export const TIER_REWARDS: Record<number, TierReward> = {
  // Act I: The Awakening (Tiers 1-5)
  1:  { type: "badge",    value: "gamer",               label: "Gamer Badge", description: "Welcome to the journey!" },
  2:  { type: "title",    value: "Button Masher",       label: "Title: 'Button Masher'", description: "Everyone starts somewhere" },
  3:  { type: "coupon",   value: "5%",                  label: "5% Off Coupon", description: "Gaming gear discount" },
  4:  { type: "cosmetic", value: "xp_boost_10",         label: "XP Boost +10%", description: "Permanent XP boost" },
  5:  { type: "bundle",   value: "profile_frame_5",     label: "★ Profile Frame + $5 Coupon", description: "First milestone reward!" },
  
  // Act II: Rising Stakes (Tiers 6-10)
  6:  { type: "badge",    value: "daily_reader",        label: "Daily Reader Badge", description: "Consistency is key" },
  7:  { type: "title",    value: "Combo King",          label: "Title: 'Combo King'", description: "Building momentum" },
  8:  { type: "coupon",   value: "7%",                  label: "7% Off Coupon", description: "Bigger savings" },
  9:  { type: "cosmetic", value: "animated_emotes",     label: "Animated Emotes", description: "Express yourself" },
  10: { type: "bundle",   value: "bronze_frame_10",     label: "★ Bronze Frame + 10% Coupon", description: "You're rising up!" },
  
  // Act III: Mid-Season Mayhem (Tiers 11-15)
  11: { type: "badge",    value: "news_ninja",          label: "News Ninja Badge", description: "Swift and informed" },
  12: { type: "title",    value: "Headline Hero",       label: "Title: 'Headline Hero'", description: "Making waves" },
  13: { type: "coupon",   value: "12%",                 label: "12% Off Coupon", description: "Serious savings" },
  14: { type: "cosmetic", value: "silver_nameplate",    label: "Silver Nameplate", description: "Stand out in comments" },
  15: { type: "bundle",   value: "silver_frame_15",     label: "★ Silver Frame + 15% Coupon", description: "Mid-season champion!" },
  
  // Act IV: Playoffs Approach (Tiers 16-20)
  16: { type: "badge",    value: "esports_oracle",      label: "Esports Oracle Badge", description: "Prediction master" },
  17: { type: "title",    value: "Final Boss",          label: "Title: 'Final Boss'", description: "Almost there" },
  18: { type: "coupon",   value: "20%",                 label: "20% Off Coupon", description: "Premium discount" },
  19: { type: "cosmetic", value: "gold_highlight",      label: "Gold Comment Highlight", description: "Your words shine" },
  20: { type: "bundle",   value: "gold_frame_20",       label: "★ Gold Frame + 25% Coupon", description: "Playoffs contender!" },
  
  // Act V: Championship (Tiers 21-25)
  21: { type: "badge",    value: "legendary",           label: "Legendary Badge", description: "Elite status" },
  22: { type: "title",    value: "Speedrunner",         label: "Title: 'Speedrunner'", description: "Fast and efficient" },
  23: { type: "coupon",   value: "30%",                 label: "30% Off Coupon", description: "VIP savings" },
  24: { type: "cosmetic", value: "diamond_effects",     label: "Diamond Visual Effects", description: "Dazzle everyone" },
  25: { type: "bundle",   value: "season_champion",     label: "★★ SEASON CHAMPION + 40% Bundle", description: "Ultimate champion!" },
};

// Leaderboard rank tiers based on percentile
export const RANK_TIERS = {
  grandmaster: { percentile: 0,   label: "Grandmaster", color: "#FF4D4D", minRank: 1 },
  master:      { percentile: 1,   label: "Master",      color: "#9D4DFF", minRank: 2 },
  diamond:     { percentile: 5,   label: "Diamond",     color: "#4DAAFF", minRank: 1 },
  platinum:    { percentile: 10,  label: "Platinum",    color: "#4DFFB8", minRank: 1 },
  gold:        { percentile: 25,  label: "Gold",        color: "#FFD700", minRank: 1 },
  silver:      { percentile: 50,  label: "Silver",      color: "#C0C0C0", minRank: 1 },
  bronze:      { percentile: 100, label: "Bronze",      color: "#CD7F32", minRank: 1 },
} as const;

export type RankTier = keyof typeof RANK_TIERS;

export function getRankTier(percentile: number): RankTier {
  if (percentile <= 1) return "grandmaster";
  if (percentile <= 5) return "master";
  if (percentile <= 10) return "diamond";
  if (percentile <= 25) return "platinum";
  if (percentile <= 50) return "gold";
  if (percentile <= 100) return "silver";
  return "bronze";
}
