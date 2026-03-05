// src/lib/xpConstants.ts

const XP_TABLE_DATA = {
  read_summary:        20,
  read_more:           35,
  article_combo:       40,
  daily_login:         50,
  streak_7:            200,
  streak_30:           600,
  season_start:        150,
  trivia_participate:  30,
  trivia_correct:      15,
  trivia_perfect:      50,
  trivia_streak_7:     100,
  predict_submit:      25,
  predict_correct:     60,
  predict_streak_5:    150,
  predict_first:       100,
  react:               10,
  comment:             25,
  receive_upvotes:     20,
  scroll_50:           5,
  scroll_90:           8,
} as const;

export type XpActionType = keyof typeof XP_TABLE_DATA;
export const XP_TABLE: Record<XpActionType, number> = XP_TABLE_DATA;

export const DAILY_CAP = 400;
export const XP_PER_TIER = 1000;
export const MAX_TIERS = 25;
export const ONBOARDING_DAYS = 3;
export const ONBOARDING_MULTIPLIER = 1.5;
export const ACTIVE_DAY_THRESHOLD = 50;

const STREAK_BYPASS_ACTIONS = new Set(["streak_7", "streak_30"]);

export function isStreakBypassAction(action: string): boolean {
  return STREAK_BYPASS_ACTIONS.has(action);
}

const CORE_ACTIONS = new Set<XpActionType>(["read_summary", "read_more"]);

export function isCoreAction(action: string): boolean {
  return CORE_ACTIONS.has(action as XpActionType);
}

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.75;
  if (streakDays >= 7)  return 1.5;
  if (streakDays >= 3)  return 1.2;
  return 1.0;
}

export type RewardType = "badge" | "title" | "coupon" | "frame" | "cosmetic";
export type TierReward = { type: RewardType; value: string; label: string };

export const TIER_REWARDS: Record<number, TierReward> = {
  1:  { type: "badge",    value: "newcomer",           label: "Newcomer Badge" },
  2:  { type: "title",    value: "Press Start",         label: "Title: 'Press Start'" },
  3:  { type: "coupon",   value: "5%",                  label: "5% Gaming Coupon" },
  4:  { type: "frame",    value: "bronze",              label: "Bronze Leaderboard Frame" },
  5:  { type: "coupon",   value: "10%",                 label: "★ 10% Coupon + 'Level Grinder' Title" },
  6:  { type: "cosmetic", value: "emote_silver",        label: "Reaction Emote Pack (Silver)" },
  7:  { type: "title",    value: "Lore Keeper",         label: "Title: 'Lore Keeper'" },
  8:  { type: "coupon",   value: "10%",                 label: "10% Coupon" },
  9:  { type: "frame",    value: "silver",              label: "Silver Leaderboard Frame" },
  10: { type: "coupon",   value: "15%",                 label: "★ 15% Coupon + Animated Badge" },
  11: { type: "title",    value: "Meta Analyst",        label: "Title: 'Meta Analyst'" },
  12: { type: "cosmetic", value: "dark_skin",           label: "Dark Mode UI Skin" },
  13: { type: "coupon",   value: "15%",                 label: "15% Coupon" },
  14: { type: "frame",    value: "gold",                label: "Gold Leaderboard Frame" },
  15: { type: "coupon",   value: "20%",                 label: "★ 20% Coupon + 'Final Boss' Title" },
  16: { type: "badge",    value: "trivia_champ",        label: "Trivia Champion Badge" },
  17: { type: "title",    value: "Esports Oracle",      label: "Title: 'Esports Oracle'" },
  18: { type: "coupon",   value: "20%",                 label: "20% Coupon + Platinum Frame" },
  19: { type: "cosmetic", value: "anim_border",         label: "Animated Profile Border" },
  20: { type: "coupon",   value: "25%",                 label: "★ 25% Mega Coupon Bundle" },
  21: { type: "title",    value: "Elite Correspondent", label: "Title: 'Elite Correspondent'" },
  22: { type: "badge",    value: "rare_season",         label: "Rare Season-Exclusive Animated Badge" },
  23: { type: "coupon",   value: "30%",                 label: "30% Coupon (Premium Partner)" },
  24: { type: "frame",    value: "diamond",             label: "Diamond Crown Frame" },
  25: { type: "coupon",   value: "40%",                 label: "★★ SEASON CHAMPION + 40% Bundle + Permanent Badge" },
};
