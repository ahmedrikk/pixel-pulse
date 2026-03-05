import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

// XP table (mirrored from src/lib/xpConstants.ts — Deno can't import from src/)
const XP_TABLE: Record<string, number> = {
  read_summary: 20, read_more: 35, article_combo: 40,
  daily_login: 50, streak_7: 200, streak_30: 600, season_start: 150,
  trivia_participate: 30, trivia_correct: 15, trivia_perfect: 50, trivia_streak_7: 100,
  predict_submit: 25, predict_correct: 60, predict_streak_5: 150, predict_first: 100,
  react: 10, comment: 25, receive_upvotes: 20,
  scroll_50: 5, scroll_90: 8,
};

const DAILY_CAP = 400;
const XP_PER_TIER = 1000;
const MAX_TIERS = 25;
const ONBOARDING_DAYS = 3;
const ACTIVE_DAY_THRESHOLD = 50;
const MS_PER_DAY = 86_400_000;
const BYPASS_ACTIONS = new Set(["streak_7", "streak_30"]);
const CORE_ACTIONS = new Set(["read_summary", "read_more"]);
// Actions where per-item dedup requires a caller-supplied ref_id (article URL, match ID, etc.)
const REF_ID_REQUIRED_ACTIONS = new Set([
  "read_summary", "read_more", "article_combo",
  "react", "comment", "receive_upvotes",
  "predict_submit", "predict_correct",
]);

function getStreakMult(days: number): number {
  if (days >= 30) return 2.0;
  if (days >= 14) return 1.75;
  if (days >= 7)  return 1.5;
  if (days >= 3)  return 1.2;
  return 1.0;
}

// Tier reward map — one entry per tier for easy auditing (rewards include real coupon values)
const TIER_REWARD_MAP: Record<number, { type: string; value: string }> = {
  1:  { type: "badge",    value: "newcomer" },
  2:  { type: "title",    value: "Press Start" },
  3:  { type: "coupon",   value: "5%" },
  4:  { type: "frame",    value: "bronze" },
  5:  { type: "coupon",   value: "10%" },
  6:  { type: "cosmetic", value: "emote_silver" },
  7:  { type: "title",    value: "Lore Keeper" },
  8:  { type: "coupon",   value: "10%" },
  9:  { type: "frame",    value: "silver" },
  10: { type: "coupon",   value: "15%" },
  11: { type: "title",    value: "Meta Analyst" },
  12: { type: "cosmetic", value: "dark_skin" },
  13: { type: "coupon",   value: "15%" },
  14: { type: "frame",    value: "gold" },
  15: { type: "coupon",   value: "20%" },
  16: { type: "badge",    value: "trivia_champ" },
  17: { type: "title",    value: "Esports Oracle" },
  18: { type: "coupon",   value: "20%" },
  19: { type: "cosmetic", value: "anim_border" },
  20: { type: "coupon",   value: "25%" },
  21: { type: "title",    value: "Elite Correspondent" },
  22: { type: "badge",    value: "rare_season" },
  23: { type: "coupon",   value: "30%" },
  24: { type: "frame",    value: "diamond" },
  25: { type: "coupon",   value: "40%" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Service-role client for DB writes (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: resolve user from JWT or verify service_role override
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: JSON_HEADERS,
      });
    }

    const body = await req.json();
    const { action_type, ref_id: rawRefId, _user_override } = body;

    let effectiveUserId: string;

    if (_user_override) {
      // Internal service-role call — compare the full Bearer token against the known
      // service role key. Direct string comparison prevents JWT payload spoofing.
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: JSON_HEADERS,
        });
      }
      effectiveUserId = _user_override;
    } else {
      // Normal user JWT — validated server-side by Supabase Auth
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: JSON_HEADERS,
        });
      }
      effectiveUserId = user.id;
    }

    // Validate action_type
    if (typeof action_type !== "string" || !action_type) {
      return new Response(JSON.stringify({ error: "action_type must be a non-empty string" }), {
        status: 400, headers: JSON_HEADERS,
      });
    }
    const baseXp = XP_TABLE[action_type];
    if (baseXp === undefined) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action_type}` }), {
        status: 400, headers: JSON_HEADERS,
      });
    }

    // Per-item actions require a ref_id to distinguish dedup keys
    if (REF_ID_REQUIRED_ACTIONS.has(action_type) && !rawRefId) {
      return new Response(JSON.stringify({ error: `ref_id required for action: ${action_type}` }), {
        status: 400, headers: JSON_HEADERS,
      });
    }

    const ref_id = rawRefId ?? "";

    // Resolve active season (after auth to avoid wasted DB query on unauth requests)
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    const activeSeasonId: number = activeSeason?.id ?? 1;

    // Load profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("xp, xp_today, xp_today_reset_date, xp_season, tier, daily_streak, streak_frozen, freeze_window_start, last_active_day, created_at")
      .eq("id", effectiveUserId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: JSON_HEADERS,
      });
    }

    // Reset xp_today if it's a new UTC day
    const todayUtc = new Date().toISOString().slice(0, 10);
    const xpToday = profile.xp_today_reset_date === todayUtc ? (profile.xp_today ?? 0) : 0;

    // Application-level dedup check (DB unique index is the hard enforcement layer)
    const { data: existing } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", effectiveUserId)
      .eq("action_type", action_type)
      .eq("ref_id", ref_id)
      .gte("created_at", `${todayUtc}T00:00:00Z`)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ awarded: 0, duplicate: true, xp_today: xpToday }),
        { headers: JSON_HEADERS }
      );
    }

    // Compute multipliers
    const isBypass = BYPASS_ACTIONS.has(action_type);
    const isCore   = CORE_ACTIONS.has(action_type);
    const daysSinceSignup = Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / MS_PER_DAY
    );
    const streakMult  = isCore ? getStreakMult(profile.daily_streak ?? 0) : 1.0;
    const onboardMult = daysSinceSignup <= ONBOARDING_DAYS ? 1.5 : 1.0;
    const raw         = Math.round(baseXp * streakMult * onboardMult);

    // Enforce daily cap (bypass actions are exempt)
    const capRemaining = Math.max(0, DAILY_CAP - xpToday);
    const awarded      = isBypass ? raw : Math.min(raw, capRemaining);

    if (awarded === 0 && !isBypass) {
      return new Response(
        JSON.stringify({ awarded: 0, capped: true, xp_today: xpToday }),
        { headers: JSON_HEADERS }
      );
    }

    // Write xp_events — unique index is the last-resort dedup guard against race conditions
    const { error: insertError } = await supabase.from("xp_events").insert({
      user_id:            effectiveUserId,
      action_type,
      ref_id,
      xp_awarded:         awarded,
      multiplier_applied: streakMult * onboardMult,
      event_date:         todayUtc,
    });
    if (insertError) {
      // 23505 = unique_violation: a concurrent request already won the race
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ awarded: 0, duplicate: true, xp_today: xpToday }),
          { headers: JSON_HEADERS }
        );
      }
      throw insertError;
    }

    // Compute new profile values
    const newXpToday    = isBypass ? xpToday : xpToday + awarded;
    const newXpSeason   = (profile.xp_season  ?? 0) + awarded;
    const newXpLifetime = (profile.xp         ?? 0) + awarded;
    const newTier       = Math.min(Math.floor(newXpSeason / XP_PER_TIER), MAX_TIERS);
    const tierUp        = newTier > (profile.tier ?? 0);

    // Streak update logic
    const lastActive  = profile.last_active_day as string | null;
    const yesterday   = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);
    let newStreak     = profile.daily_streak     ?? 0;
    let streakFrozen  = profile.streak_frozen    ?? false;
    let freezeStart   = profile.freeze_window_start as string | null;
    let newLastActive = lastActive;

    // Only update streak when this action pushes xp_today >= ACTIVE_DAY_THRESHOLD
    if (!isBypass && newXpToday >= ACTIVE_DAY_THRESHOLD && lastActive !== todayUtc) {
      newLastActive = todayUtc;

      if (lastActive === yesterday) {
        // Consecutive day — extend streak, clear freeze
        newStreak    = (profile.daily_streak ?? 0) + 1;
        streakFrozen = false;
      } else if (lastActive) {
        const daysDiff = Math.floor(
          (new Date(todayUtc).getTime() - new Date(lastActive).getTime()) / MS_PER_DAY
        );
        // daysDiff === 2: exactly one missed day. The outer !streakFrozen guard prevents
        // back-to-back freeze abuse — a second gap within the 14-day window breaks the streak.
        if (daysDiff === 2 && !streakFrozen) {
          // Missed exactly 1 day — grant freeze (1 per 14-day rolling window)
          const windowStart = freezeStart ? new Date(freezeStart) : null;
          const withinWindow = windowStart
            ? new Date(todayUtc).getTime() - windowStart.getTime() <= 14 * MS_PER_DAY
            : false;
          if (!withinWindow) {
            freezeStart = todayUtc;
          }
          streakFrozen = true;
          // streak count stays the same
        } else {
          // Streak broken
          newStreak    = 1;
          streakFrozen = false;
          freezeStart  = null;
        }
      } else {
        // First ever active day
        newStreak = 1;
      }
    }

    // Persist updated profile
    const { error: updateError } = await supabase.from("profiles").update({
      xp:                   newXpLifetime,
      xp_today:             newXpToday,
      xp_today_reset_date:  todayUtc,
      xp_season:            newXpSeason,
      tier:                 newTier,
      daily_streak:         newStreak,
      streak_frozen:        streakFrozen,
      freeze_window_start:  freezeStart,
      last_active_day:      newLastActive,
    }).eq("id", effectiveUserId);
    if (updateError) throw updateError;

    // Tier-up: grant reward.
    // Push notifications fire via a Postgres trigger on user_rewards (notify-tier-up function).
    // Season/tier reset at season end is handled by a separate admin migration, not here.
    if (tierUp) {
      const reward = TIER_REWARD_MAP[newTier];
      if (reward) {
        const { error: rewardError } = await supabase.from("user_rewards").insert({
          user_id:      effectiveUserId,
          season_id:    activeSeasonId,
          tier:         newTier,
          reward_type:  reward.type,
          reward_value: reward.value,
        });
        if (rewardError) throw rewardError;

        // Append title to user_titles (idempotent RPC)
        if (reward.type === "title") {
          const { error: titleError } = await supabase.rpc("append_unlocked_title", {
            uid:   effectiveUserId,
            title: reward.value,
          });
          if (titleError) throw titleError;
        }
      }
    }

    return new Response(
      JSON.stringify({
        awarded,
        xp_today:     newXpToday,
        xp_season:    newXpSeason,
        xp_lifetime:  newXpLifetime,
        tier:         newTier,
        streak_count: newStreak,
        tier_up:      tierUp,
      }),
      { headers: JSON_HEADERS }
    );

  } catch (err) {
    console.error("award-xp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
});
