/**
 * XP Helper — Bridge between frontend actions and the award-xp Edge Function.
 *
 * For authenticated users: calls the server-side award-xp function which handles
 * daily caps, dedup, streak multipliers, tier calculation, and reward granting.
 *
 * For guests: falls back to local XPContext (localStorage-based).
 */

import { supabase } from "@/integrations/supabase/client";

const AWARD_XP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/award-xp`;

export interface AwardXPResult {
  awarded: number;
  xp_today: number;
  xp_season: number;
  xp_lifetime: number;
  tier: number;
  streak_count: number;
  tier_up: boolean;
  duplicate?: boolean;
  capped?: boolean;
  error?: string;
}

export interface UserReward {
  id: string;
  user_id: string;
  season_id: number;
  tier: number;
  reward_type: string;
  reward_value: string;
  claimed: boolean;
  claimed_at: string | null;
  redeemed_at: string | null;
}

/**
 * Award XP for a user action.
 * Authenticated → calls award-xp Edge Function (source of truth).
 * Guest → no-op (guest XP is handled locally by XPContext).
 */
export async function awardXP(
  actionType: string,
  refId: string = ""
): Promise<AwardXPResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Guest: local XPContext handles this separately
    return null;
  }

  try {
    const res = await fetch(AWARD_XP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_type: actionType,
        ref_id: refId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn("award-xp error:", data.error || res.statusText);
      return { ...data, error: data.error || res.statusText } as AwardXPResult;
    }

    return data as AwardXPResult;
  } catch (err) {
    console.error("awardXP fetch error:", err);
    return null;
  }
}

/**
 * Fetch the current user's battle-pass rewards.
 */
export async function fetchUserRewards(): Promise<UserReward[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_rewards")
    .select("*")
    .eq("user_id", user.id)
    .order("tier", { ascending: true });

  if (error) {
    console.error("fetchUserRewards error:", error);
    return [];
  }

  return (data || []) as UserReward[];
}

/**
 * Mark a reward as claimed for a given user + tier.
 * Upserts if no row exists (e.g. retroactive claim).
 */
export async function claimReward(userId: string, tier: number): Promise<boolean> {
  // Check existing row
  const { data: existing } = await supabase
    .from("user_rewards")
    .select("id")
    .eq("user_id", userId)
    .eq("tier", tier)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("user_rewards")
      .update({ claimed: true, claimed_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      console.error("claimReward update error:", error);
      return false;
    }
    return true;
  }

  // Insert new row if none exists
  const { error: insertError } = await supabase
    .from("user_rewards")
    .insert({
      user_id: userId,
      tier,
      reward_type: "badge",
      reward_value: `Tier ${tier} Reward`,
      claimed: true,
      claimed_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error("claimReward insert error:", insertError);
    return false;
  }
  return true;
}

/**
 * Fetch the current user's profile XP fields.
 */
export async function fetchXPProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("xp, xp_season, xp_today, xp_today_reset_date, tier, daily_streak, level")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("fetchXPProfile error:", error);
    return null;
  }

  return data;
}
