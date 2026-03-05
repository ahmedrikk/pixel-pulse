# Battle Pass XP System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full Season 1 Battle Pass XP system — 7 XP sources, 25 tiers, 400 XP/day cap, streaks, trivia, esports predictions, leaderboards.

**Architecture:** Central `award-xp` Supabase Edge Function owns all cap enforcement and dedup. Two helper edge functions (`generate-trivia`, `resolve-predictions`) handle domain-specific logic. A thin `xpService.ts` client layer calls edge functions from the frontend.

**Tech Stack:** React 18, TypeScript, Vite, Supabase (Postgres + Edge Functions), TanStack Query, Tailwind, shadcn/ui, Vitest, OpenRouter API (via existing config pattern)

**Design doc:** `docs/plans/2026-03-05-battle-pass-xp-design.md`

---

## Task 1: DB Migration — Extend `profiles` table

**Files:**
- Create: `supabase/migrations/20260305000001_add_xp_season_fields.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260305000001_add_xp_season_fields.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_today          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_today_reset_date DATE,
  ADD COLUMN IF NOT EXISTS xp_season         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_frozen     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS freeze_window_start DATE,
  ADD COLUMN IF NOT EXISTS last_active_day   DATE;

-- Backfill: existing xp column becomes xp_lifetime (rename semantics only — keep column)
-- Existing daily_streak is already the streak count
-- Seed Season 1
INSERT INTO public.seasons (id, name, start_date, end_date, is_active)
VALUES (1, 'Season 1', CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', TRUE)
ON CONFLICT DO NOTHING;
```

**Step 2: Apply migration**

```bash
cd pixel-pulse
npx supabase db push
# Expected: Migration applied successfully
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260305000001_add_xp_season_fields.sql
git commit -m "feat(db): add xp_season, tier, streak fields to profiles"
```

---

## Task 2: DB Migration — Create new XP system tables

**Files:**
- Create: `supabase/migrations/20260305000002_create_xp_tables.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260305000002_create_xp_tables.sql

-- Seasons
CREATE TABLE IF NOT EXISTS public.seasons (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_active  BOOLEAN DEFAULT FALSE
);

-- XP audit log + dedup
CREATE TABLE IF NOT EXISTS public.xp_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action_type        TEXT NOT NULL,
  ref_id             TEXT,
  xp_awarded         INTEGER NOT NULL,
  multiplier_applied NUMERIC(4,2) DEFAULT 1.0,
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_dedup
  ON public.xp_events (user_id, action_type, COALESCE(ref_id,''), (created_at::date));

-- Trivia question pool
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  options       JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  topic         TEXT,
  generated_at  TIMESTAMPTZ DEFAULT now()
);

-- Per-user trivia appearance tracking (for 14-day rotation)
CREATE TABLE IF NOT EXISTS public.trivia_user_seen (
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  seen_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- Daily trivia attempt (1 per user per day)
CREATE TABLE IF NOT EXISTS public.trivia_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_date      DATE NOT NULL,
  questions_json JSONB NOT NULL,
  answers_json   JSONB,
  score          INTEGER,
  xp_awarded     INTEGER DEFAULT 0,
  completed_at   TIMESTAMPTZ,
  UNIQUE (user_id, quiz_date)
);

-- Esports predictions
CREATE TABLE IF NOT EXISTS public.predictions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  match_id         INTEGER NOT NULL,
  predicted_team   TEXT NOT NULL,
  is_correct       BOOLEAN,
  xp_participation INTEGER DEFAULT 0,
  xp_bonus         INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  UNIQUE (user_id, match_id)
);

-- Per-user correct-prediction streak
CREATE TABLE IF NOT EXISTS public.prediction_streaks (
  user_id          UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak   INTEGER DEFAULT 0,
  last_resolved_at TIMESTAMPTZ
);

-- Article read dedup (per user, per article, per day)
CREATE TABLE IF NOT EXISTS public.article_reads (
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_url  TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  read_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, article_url, action_type, read_date)
);

-- Article reactions + comments (1 react + 1 comment per user per article)
CREATE TABLE IF NOT EXISTS public.article_interactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  article_url      TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('react','comment')),
  content          TEXT,
  upvote_count     INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, article_url, interaction_type)
);

-- Tier rewards per season
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id    INTEGER REFERENCES public.seasons(id),
  tier         INTEGER NOT NULL,
  reward_type  TEXT NOT NULL,
  reward_value TEXT,
  claimed_at   TIMESTAMPTZ DEFAULT now(),
  redeemed_at  TIMESTAMPTZ
);

-- User titles (active + unlocked)
CREATE TABLE IF NOT EXISTS public.user_titles (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  active_title    TEXT,
  unlocked_titles TEXT[] DEFAULT '{}'
);

-- RLS: enable for all new tables (profiles of owner only)
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own xp_events" ON public.xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own trivia" ON public.trivia_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own predictions" ON public.predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own reads" ON public.article_reads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own interactions" ON public.article_interactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own rewards" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own titles" ON public.user_titles FOR ALL USING (auth.uid() = user_id);
-- trivia_questions and seasons are public read
ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read questions" ON public.trivia_questions FOR SELECT USING (TRUE);
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read seasons" ON public.seasons FOR SELECT USING (TRUE);
```

**Step 2: Apply**

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260305000002_create_xp_tables.sql
git commit -m "feat(db): create xp_events, trivia, predictions, rewards tables"
```

---

## Task 3: XP Constants Module

**Files:**
- Create: `src/lib/xpConstants.ts`
- Create: `src/lib/xpConstants.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/xpConstants.test.ts
import { describe, it, expect } from "vitest";
import { XP_TABLE, DAILY_CAP, getStreakMultiplier, isStreakBypassAction } from "./xpConstants";

describe("XP constants", () => {
  it("read_summary earns 20 XP", () => {
    expect(XP_TABLE.read_summary).toBe(20);
  });

  it("read_more earns 35 XP", () => {
    expect(XP_TABLE.read_more).toBe(35);
  });

  it("daily_login earns 50 XP", () => {
    expect(XP_TABLE.daily_login).toBe(50);
  });

  it("DAILY_CAP is 400", () => {
    expect(DAILY_CAP).toBe(400);
  });

  it("streak multiplier for day 1 is 1.0", () => {
    expect(getStreakMultiplier(1)).toBe(1.0);
  });

  it("streak multiplier for day 3 is 1.2", () => {
    expect(getStreakMultiplier(3)).toBe(1.2);
  });

  it("streak multiplier for day 7 is 1.5", () => {
    expect(getStreakMultiplier(7)).toBe(1.5);
  });

  it("streak multiplier for day 14 is 1.75", () => {
    expect(getStreakMultiplier(14)).toBe(1.75);
  });

  it("streak multiplier for day 30 is 2.0", () => {
    expect(getStreakMultiplier(30)).toBe(2.0);
  });

  it("streak_7 bypasses daily cap", () => {
    expect(isStreakBypassAction("streak_7")).toBe(true);
  });

  it("read_summary does not bypass cap", () => {
    expect(isStreakBypassAction("read_summary")).toBe(false);
  });
});
```

**Step 2: Run to confirm failure**

```bash
bun run test src/lib/xpConstants.test.ts
# Expected: FAIL — xpConstants not found
```

**Step 3: Implement**

```typescript
// src/lib/xpConstants.ts

export const XP_TABLE: Record<string, number> = {
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
};

export const DAILY_CAP = 400;
export const XP_PER_TIER = 1000;
export const MAX_TIERS = 25;
export const ONBOARDING_DAYS = 3;
export const ONBOARDING_MULTIPLIER = 1.5;
export const ACTIVE_DAY_THRESHOLD = 50; // XP needed for an "active day"

const STREAK_BYPASS_ACTIONS = new Set(["streak_7", "streak_30"]);

export function isStreakBypassAction(action: string): boolean {
  return STREAK_BYPASS_ACTIONS.has(action);
}

export function isCoreAction(action: string): boolean {
  return action === "read_summary" || action === "read_more";
}

export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.75;
  if (streakDays >= 7)  return 1.5;
  if (streakDays >= 3)  return 1.2;
  return 1.0;
}

export const TIER_REWARDS: Record<number, { type: string; value: string; label: string }> = {
  1:  { type: "badge",    value: "newcomer",         label: "Newcomer Badge" },
  2:  { type: "title",    value: "Press Start",       label: "Title: 'Press Start'" },
  3:  { type: "coupon",   value: "5%",                label: "5% Gaming Coupon" },
  4:  { type: "frame",    value: "bronze",            label: "Bronze Leaderboard Frame" },
  5:  { type: "coupon",   value: "10%",               label: "★ 10% Coupon + 'Level Grinder' Title" },
  6:  { type: "cosmetic", value: "emote_silver",      label: "Reaction Emote Pack (Silver)" },
  7:  { type: "title",    value: "Lore Keeper",       label: "Title: 'Lore Keeper'" },
  8:  { type: "coupon",   value: "10%",               label: "10% Coupon" },
  9:  { type: "frame",    value: "silver",            label: "Silver Leaderboard Frame" },
  10: { type: "coupon",   value: "15%",               label: "★ 15% Coupon + Animated Badge" },
  11: { type: "title",    value: "Meta Analyst",      label: "Title: 'Meta Analyst'" },
  12: { type: "cosmetic", value: "dark_skin",         label: "Dark Mode UI Skin" },
  13: { type: "coupon",   value: "15%",               label: "15% Coupon" },
  14: { type: "frame",    value: "gold",              label: "Gold Leaderboard Frame" },
  15: { type: "coupon",   value: "20%",               label: "★ 20% Coupon + 'Final Boss' Title" },
  16: { type: "badge",    value: "trivia_champ",      label: "Trivia Champion Badge" },
  17: { type: "title",    value: "Esports Oracle",    label: "Title: 'Esports Oracle'" },
  18: { type: "coupon",   value: "20%",               label: "20% Coupon + Platinum Frame" },
  19: { type: "cosmetic", value: "anim_border",       label: "Animated Profile Border" },
  20: { type: "coupon",   value: "25%",               label: "★ 25% Mega Coupon Bundle" },
  21: { type: "title",    value: "Elite Correspondent", label: "Title: 'Elite Correspondent'" },
  22: { type: "badge",    value: "rare_season",       label: "Rare Season-Exclusive Animated Badge" },
  23: { type: "coupon",   value: "30%",               label: "30% Coupon (Premium Partner)" },
  24: { type: "frame",    value: "diamond",           label: "Diamond Crown Frame" },
  25: { type: "coupon",   value: "40%",               label: "★★ SEASON CHAMPION + 40% Bundle + Permanent Badge" },
};
```

**Step 4: Run tests**

```bash
bun run test src/lib/xpConstants.test.ts
# Expected: PASS (12 tests)
```

**Step 5: Commit**

```bash
git add src/lib/xpConstants.ts src/lib/xpConstants.test.ts
git commit -m "feat(xp): add XP constants, streak multiplier, tier rewards table"
```

---

## Task 4: `award-xp` Edge Function

**Files:**
- Create: `supabase/functions/award-xp/index.ts`

**Step 1: Create the function**

```typescript
// supabase/functions/award-xp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
const BYPASS_ACTIONS = new Set(["streak_7", "streak_30"]);
const CORE_ACTIONS = new Set(["read_summary", "read_more"]);

function getStreakMult(days: number): number {
  if (days >= 30) return 2.0;
  if (days >= 14) return 1.75;
  if (days >= 7)  return 1.5;
  if (days >= 3)  return 1.2;
  return 1.0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { action_type, ref_id } = await req.json();
    const baseXp = XP_TABLE[action_type];
    if (!baseXp) return new Response(JSON.stringify({ error: `Unknown action: ${action_type}` }), { status: 400, headers: corsHeaders });

    // Load profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("xp, xp_today, xp_today_reset_date, xp_season, tier, daily_streak, streak_frozen, freeze_window_start, last_active_day, created_at")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });

    // Reset xp_today if new UTC day
    const todayUtc = new Date().toISOString().slice(0, 10);
    let xpToday = profile.xp_today_reset_date === todayUtc ? profile.xp_today : 0;

    // Dedup check via xp_events unique index
    const refIdForDedup = ref_id ?? "";
    const { data: existing } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("action_type", action_type)
      .eq("ref_id", refIdForDedup)
      .gte("created_at", `${todayUtc}T00:00:00Z`)
      .maybeSingle();
    if (existing) return new Response(JSON.stringify({ awarded: 0, duplicate: true, xp_today: xpToday }), { headers: corsHeaders });

    // Multipliers
    const isBypass = BYPASS_ACTIONS.has(action_type);
    const isCore = CORE_ACTIONS.has(action_type);
    const daysSinceSignup = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
    const streakMult = isCore ? getStreakMult(profile.daily_streak ?? 0) : 1.0;
    const onboardMult = daysSinceSignup <= 3 ? 1.5 : 1.0;
    const raw = Math.round(baseXp * streakMult * onboardMult);

    // Enforce cap
    const capRemaining = Math.max(0, DAILY_CAP - xpToday);
    const awarded = isBypass ? raw : Math.min(raw, capRemaining);
    if (awarded === 0 && !isBypass) {
      return new Response(JSON.stringify({ awarded: 0, capped: true, xp_today: xpToday }), { headers: corsHeaders });
    }

    // Persist xp_events
    await supabase.from("xp_events").insert({
      user_id: user.id, action_type, ref_id: refIdForDedup, xp_awarded: awarded,
      multiplier_applied: streakMult * onboardMult,
    });

    // Update profile fields
    const newXpToday = isBypass ? xpToday : xpToday + awarded;
    const newXpSeason = (profile.xp_season ?? 0) + awarded;
    const newXpLifetime = (profile.xp ?? 0) + awarded;
    const newTier = Math.min(Math.floor(newXpSeason / XP_PER_TIER), MAX_TIERS);
    const tierUp = newTier > (profile.tier ?? 0);

    // Streak update (active day = 50+ XP earned today, not counting bypass)
    const effectiveXpToday = newXpToday;
    let newStreak = profile.daily_streak ?? 0;
    let streakFrozen = profile.streak_frozen ?? false;
    let freezeWindowStart = profile.freeze_window_start;
    const lastActive = profile.last_active_day;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let newLastActiveDay = profile.last_active_day;

    if (effectiveXpToday >= 50 && profile.last_active_day !== todayUtc) {
      newLastActiveDay = todayUtc;
      if (lastActive === yesterday) {
        newStreak = (profile.daily_streak ?? 0) + 1;
        streakFrozen = false;
      } else if (lastActive) {
        const daysDiff = Math.floor((new Date(todayUtc).getTime() - new Date(lastActive).getTime()) / 86400000);
        if (daysDiff === 2 && !streakFrozen) {
          // Grace period: missed 1 day, freeze it
          streakFrozen = true;
          newStreak = profile.daily_streak ?? 0;
          // Reset freeze window if outside rolling 14-day window
          if (!freezeWindowStart || new Date(todayUtc).getTime() - new Date(freezeWindowStart).getTime() > 14 * 86400000) {
            freezeWindowStart = todayUtc;
          }
        } else {
          // Streak broken
          newStreak = 1;
          streakFrozen = false;
          freezeWindowStart = null;
        }
      } else {
        newStreak = 1;
      }
    }

    await supabase.from("profiles").update({
      xp: newXpLifetime,
      xp_today: newXpToday,
      xp_today_reset_date: todayUtc,
      xp_season: newXpSeason,
      tier: newTier,
      daily_streak: newStreak,
      streak_frozen: streakFrozen,
      freeze_window_start: freezeWindowStart,
      last_active_day: newLastActiveDay,
    }).eq("id", user.id);

    // Tier-up: insert user_rewards + user_titles
    if (tierUp) {
      const TIER_REWARDS: Record<number, { type: string; value: string }> = {
        1:{type:"badge",value:"newcomer"},2:{type:"title",value:"Press Start"},
        3:{type:"coupon",value:"5%"},4:{type:"frame",value:"bronze"},
        5:{type:"coupon",value:"10%"},6:{type:"cosmetic",value:"emote_silver"},
        7:{type:"title",value:"Lore Keeper"},8:{type:"coupon",value:"10%"},
        9:{type:"frame",value:"silver"},10:{type:"coupon",value:"15%"},
        11:{type:"title",value:"Meta Analyst"},12:{type:"cosmetic",value:"dark_skin"},
        13:{type:"coupon",value:"15%"},14:{type:"frame",value:"gold"},
        15:{type:"coupon",value:"20%"},16:{type:"badge",value:"trivia_champ"},
        17:{type:"title",value:"Esports Oracle"},18:{type:"coupon",value:"20%"},
        19:{type:"cosmetic",value:"anim_border"},20:{type:"coupon",value:"25%"},
        21:{type:"title",value:"Elite Correspondent"},22:{type:"badge",value:"rare_season"},
        23:{type:"coupon",value:"30%"},24:{type:"frame",value:"diamond"},
        25:{type:"coupon",value:"40%"},
      };
      const reward = TIER_REWARDS[newTier];
      if (reward) {
        await supabase.from("user_rewards").insert({ user_id: user.id, season_id: 1, tier: newTier, reward_type: reward.type, reward_value: reward.value });
        if (reward.type === "title") {
          await supabase.from("user_titles").upsert({ user_id: user.id }, { onConflict: "user_id" });
          await supabase.rpc("append_unlocked_title", { uid: user.id, title: reward.value });
        }
      }
    }

    return new Response(JSON.stringify({
      awarded, xp_today: newXpToday, xp_season: newXpSeason, xp_lifetime: newXpLifetime,
      tier: newTier, streak_count: newStreak, tier_up: tierUp,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("award-xp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
```

**Step 2: Add the `append_unlocked_title` Postgres function** (needed by edge function)

Create `supabase/migrations/20260305000003_add_rpc_helpers.sql`:

```sql
CREATE OR REPLACE FUNCTION public.append_unlocked_title(uid UUID, title TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_titles (user_id, unlocked_titles)
  VALUES (uid, ARRAY[title])
  ON CONFLICT (user_id) DO UPDATE
  SET unlocked_titles = array_append(
    COALESCE(user_titles.unlocked_titles, '{}'), title
  )
  WHERE NOT (title = ANY(COALESCE(user_titles.unlocked_titles, '{}')));
END;
$$;
```

```bash
npx supabase db push
```

**Step 3: Deploy edge function**

```bash
npx supabase functions deploy award-xp
```

**Step 4: Smoke test** (replace TOKEN with a real user JWT from the browser)

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/award-xp \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action_type":"daily_login"}'
# Expected: {"awarded":50,"xp_today":50,...}
```

**Step 5: Commit**

```bash
git add supabase/functions/award-xp/ supabase/migrations/20260305000003_add_rpc_helpers.sql
git commit -m "feat(edge): implement award-xp edge function with cap, dedup, streak, tier-up"
```

---

## Task 5: `generate-trivia` Edge Function

**Files:**
- Create: `supabase/functions/generate-trivia/index.ts`

**Step 1: Create the function**

```typescript
// supabase/functions/generate-trivia/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUESTIONS_PER_QUIZ = 5;
const ROTATION_DAYS = 14;

async function generateQuestionsFromOpenRouter(): Promise<Array<{question:string;options:string[];correct_index:number;topic:string}>> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const prompt = `Generate ${QUESTIONS_PER_QUIZ} unique gaming trivia questions. Return ONLY a JSON array with no markdown.

Each object must have:
- "question": string (clear, specific gaming question)
- "options": array of exactly 4 strings (A, B, C, D answer choices)
- "correct_index": integer 0-3 (index of the correct answer)
- "topic": string (e.g. "FPS", "RPG", "Esports", "PlayStation", "History")

Mix difficulty. Cover different games, platforms, and eras. Example:
[{"question":"Which game introduced the Battle Royale genre to mainstream audiences in 2017?","options":["Fortnite","PUBG","H1Z1","Warzone"],"correct_index":1,"topic":"History"}]`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const clean = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const todayUtc = new Date().toISOString().slice(0, 10);

  // Check if attempt already exists for today
  const { data: existing } = await supabase
    .from("trivia_attempts")
    .select("id, questions_json, completed_at")
    .eq("user_id", user.id)
    .eq("quiz_date", todayUtc)
    .maybeSingle();

  if (existing) {
    // Return questions without correct_index (already started or completed)
    const qs = (existing.questions_json as any[]).map(q => ({ question: q.question, options: q.options, topic: q.topic }));
    return new Response(JSON.stringify({ questions: qs, already_completed: !!existing.completed_at }), { headers: corsHeaders });
  }

  // Find questions not seen by this user in last 14 days
  const cutoff = new Date(Date.now() - ROTATION_DAYS * 86400000).toISOString();
  const { data: seenIds } = await supabase
    .from("trivia_user_seen")
    .select("question_id")
    .eq("user_id", user.id)
    .gte("seen_at", cutoff);
  const seenSet = new Set((seenIds ?? []).map((r: any) => r.question_id));

  const { data: pool } = await supabase
    .from("trivia_questions")
    .select("id, question, options, correct_index, topic")
    .not("id", "in", seenSet.size > 0 ? `(${[...seenSet].join(",")})` : "(00000000-0000-0000-0000-000000000000)")
    .limit(QUESTIONS_PER_QUIZ);

  let questions = pool ?? [];

  // Generate more from AI if pool is insufficient
  if (questions.length < QUESTIONS_PER_QUIZ) {
    const generated = await generateQuestionsFromOpenRouter();
    const { data: inserted } = await supabase.from("trivia_questions").insert(generated).select();
    questions = [...questions, ...(inserted ?? [])].slice(0, QUESTIONS_PER_QUIZ);
  }

  // Save attempt (questions include correct_index — stored server-side only)
  await supabase.from("trivia_attempts").insert({
    user_id: user.id, quiz_date: todayUtc, questions_json: questions,
  });

  // Track seen
  await supabase.from("trivia_user_seen").upsert(
    questions.map((q: any) => ({ user_id: user.id, question_id: q.id })),
    { onConflict: "user_id,question_id" }
  );

  // Return questions WITHOUT correct_index
  const safeQuestions = questions.map((q: any) => ({ id: q.id, question: q.question, options: q.options, topic: q.topic }));
  return new Response(JSON.stringify({ questions: safeQuestions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
```

**Step 2: Add submit-trivia handler** — add `supabase/functions/submit-trivia/index.ts`:

```typescript
// supabase/functions/submit-trivia/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const authHeader = req.headers.get("Authorization");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader! } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const { answers } = await req.json(); // number[] — index of chosen option per question
  const todayUtc = new Date().toISOString().slice(0, 10);

  const { data: attempt } = await supabase.from("trivia_attempts").select("*").eq("user_id", user.id).eq("quiz_date", todayUtc).maybeSingle();
  if (!attempt) return new Response(JSON.stringify({ error: "No quiz for today" }), { status: 404, headers: corsHeaders });
  if (attempt.completed_at) return new Response(JSON.stringify({ error: "Already submitted" }), { status: 409, headers: corsHeaders });

  const questions: any[] = attempt.questions_json;
  let score = 0;
  const results = questions.map((q: any, i: number) => {
    const correct = answers[i] === q.correct_index;
    if (correct) score++;
    return { correct, correct_index: q.correct_index };
  });

  // Award XP via award-xp endpoint
  const baseUrl = Deno.env.get("SUPABASE_URL")!.replace("supabase.co", "supabase.co");
  const awardXp = async (action: string, ref: string) => {
    await fetch(`${baseUrl}/functions/v1/award-xp`, {
      method: "POST", headers: { "Authorization": authHeader!, "Content-Type": "application/json" },
      body: JSON.stringify({ action_type: action, ref_id: ref }),
    });
  };

  await awardXp("trivia_participate", todayUtc);
  for (let i = 0; i < score; i++) await awardXp("trivia_correct", `${todayUtc}-q${i}`);
  if (score === questions.length) await awardXp("trivia_perfect", todayUtc);

  await supabase.from("trivia_attempts").update({ answers_json: answers, score, completed_at: new Date().toISOString() }).eq("id", attempt.id);

  return new Response(JSON.stringify({ score, total: questions.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
```

**Step 3: Deploy both**

```bash
npx supabase functions deploy generate-trivia
npx supabase functions deploy submit-trivia
```

**Step 4: Commit**

```bash
git add supabase/functions/generate-trivia/ supabase/functions/submit-trivia/
git commit -m "feat(edge): generate-trivia and submit-trivia edge functions"
```

---

## Task 6: `resolve-predictions` Edge Function

**Files:**
- Create: `supabase/functions/resolve-predictions/index.ts`

**Step 1: Create the function**

```typescript
// supabase/functions/resolve-predictions/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin-only: check secret key header
  const adminKey = req.headers.get("x-admin-key");
  if (adminKey !== Deno.env.get("ADMIN_SECRET_KEY")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { match_id, winning_team, cancelled } = await req.json();

  // Fetch all predictions for this match
  const { data: preds } = await supabase.from("predictions").select("*").eq("match_id", match_id).is("resolved_at", null);
  if (!preds?.length) return new Response(JSON.stringify({ resolved: 0 }), { headers: corsHeaders });

  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  let resolved = 0;

  for (const pred of preds) {
    const isCorrect = !cancelled && pred.predicted_team === winning_team;

    await supabase.from("predictions").update({ is_correct: cancelled ? null : isCorrect, resolved_at: new Date().toISOString() }).eq("id", pred.id);

    if (cancelled) {
      // Refund participation XP
      if (pred.xp_participation > 0) {
        await supabase.from("xp_events").insert({ user_id: pred.user_id, action_type: "predict_refund", ref_id: String(match_id), xp_awarded: -pred.xp_participation });
        await supabase.rpc("increment_xp", { uid: pred.user_id, delta_today: -pred.xp_participation, delta_season: -pred.xp_participation, delta_lifetime: -pred.xp_participation });
      }
    } else if (isCorrect) {
      // Award correct prediction bonus via award-xp
      await fetch(`${baseUrl}/functions/v1/award-xp`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: "predict_correct", ref_id: String(match_id), _user_override: pred.user_id }),
      });
    }
    resolved++;
  }

  return new Response(JSON.stringify({ resolved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
```

**Step 2: Add `increment_xp` Postgres RPC** to `supabase/migrations/20260305000003_add_rpc_helpers.sql` (append):

```sql
CREATE OR REPLACE FUNCTION public.increment_xp(uid UUID, delta_today INTEGER, delta_season INTEGER, delta_lifetime INTEGER)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.profiles
  SET xp_today  = GREATEST(0, xp_today  + delta_today),
      xp_season = GREATEST(0, xp_season + delta_season),
      xp        = GREATEST(0, xp        + delta_lifetime)
  WHERE id = uid;
$$;
```

Also update `award-xp/index.ts` to support `_user_override` for service-role calls (add near the top of the try block, after getting user):

```typescript
// After getting user from JWT, check for service-role override:
const body = await req.json();
const { action_type, ref_id, _user_override } = body;
const effectiveUserId = _user_override ?? user?.id;
// Use effectiveUserId throughout instead of user.id
```

**Step 3: Deploy**

```bash
npx supabase db push
npx supabase functions deploy resolve-predictions
npx supabase functions deploy award-xp  # redeploy with _user_override support
```

**Step 4: Commit**

```bash
git add supabase/functions/resolve-predictions/
git commit -m "feat(edge): resolve-predictions with XP payout and cancellation refund"
```

---

## Task 7: `xpService.ts` Client Layer

**Files:**
- Create: `src/lib/xpService.ts`
- Create: `src/lib/xpService.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/xpService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase functions invoke
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { awarded: 20, xp_today: 20 }, error: null }),
    },
  },
}));

import { trackArticleRead, trackReadMore, claimDailyLogin } from "./xpService";

describe("xpService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trackArticleRead calls award-xp with read_summary", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const result = await trackArticleRead("https://ign.com/article/1");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "read_summary", ref_id: "https://ign.com/article/1" },
    });
    expect(result?.awarded).toBe(20);
  });

  it("trackReadMore calls award-xp with read_more", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await trackReadMore("https://ign.com/article/1");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "read_more", ref_id: "https://ign.com/article/1" },
    });
  });

  it("claimDailyLogin calls award-xp with daily_login", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await claimDailyLogin();
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "daily_login", ref_id: undefined },
    });
  });
});
```

**Step 2: Run to confirm failure**

```bash
bun run test src/lib/xpService.test.ts
# Expected: FAIL
```

**Step 3: Implement**

```typescript
// src/lib/xpService.ts
import { supabase } from "@/integrations/supabase/client";

interface XpResult {
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

async function awardXp(action_type: string, ref_id?: string): Promise<XpResult | null> {
  const { data, error } = await supabase.functions.invoke("award-xp", {
    body: { action_type, ref_id },
  });
  if (error) { console.error(`XP award failed (${action_type}):`, error); return null; }
  return data as XpResult;
}

export const trackArticleRead = (url: string) => awardXp("read_summary", url);
export const trackReadMore    = (url: string) => awardXp("read_more", url);
export const trackArticleCombo = ()           => awardXp("article_combo");
export const claimDailyLogin  = ()            => awardXp("daily_login");
export const trackReaction    = (url: string, emoji: string) => awardXp("react", `${url}:${emoji}`);
export const trackComment     = (url: string) => awardXp("comment", url);
export const trackScroll      = (page: string, depth: 50 | 90) =>
  awardXp(depth === 50 ? "scroll_50" : "scroll_90", page);

export async function submitPrediction(matchId: number, team: string): Promise<XpResult | null> {
  // Record prediction in DB first
  const { error } = await supabase.from("predictions").insert({
    match_id: matchId, predicted_team: team, xp_participation: 25,
  });
  if (error) { console.error("Prediction insert failed:", error); return null; }
  return awardXp("predict_submit", String(matchId));
}

export async function getTodayTrivia(): Promise<{ questions: TriviaQuestion[] } | null> {
  const { data, error } = await supabase.functions.invoke("generate-trivia", { body: {} });
  if (error) { console.error("Trivia fetch failed:", error); return null; }
  return data;
}

export async function submitTrivia(answers: number[]): Promise<{ score: number; total: number; results: { correct: boolean; correct_index: number }[] } | null> {
  const { data, error } = await supabase.functions.invoke("submit-trivia", { body: { answers } });
  if (error) { console.error("Trivia submit failed:", error); return null; }
  return data;
}

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
}
```

**Step 4: Run tests**

```bash
bun run test src/lib/xpService.test.ts
# Expected: PASS (3 tests)
```

**Step 5: Commit**

```bash
git add src/lib/xpService.ts src/lib/xpService.test.ts
git commit -m "feat(xp): xpService client layer — thin wrapper over award-xp edge function"
```

---

## Task 8: `useScrollDepth` Hook

**Files:**
- Create: `src/hooks/useScrollDepth.ts`
- Create: `src/hooks/useScrollDepth.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/useScrollDepth.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollDepth } from "./useScrollDepth";

describe("useScrollDepth", () => {
  it("registers IntersectionObserver on mount", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", vi.fn(() => ({ observe, disconnect })));

    renderHook(() => useScrollDepth("test-page", vi.fn()));
    expect(IntersectionObserver).toHaveBeenCalled();
  });
});
```

**Step 2: Run to confirm failure**

```bash
bun run test src/hooks/useScrollDepth.test.ts
# Expected: FAIL
```

**Step 3: Implement**

```typescript
// src/hooks/useScrollDepth.ts
import { useEffect, useRef } from "react";

export function useScrollDepth(pageKey: string, onDepth: (depth: 50 | 90) => void) {
  const fired50 = useRef(false);
  const fired90 = useRef(false);

  useEffect(() => {
    fired50.current = false;
    fired90.current = false;

    const sentinel50 = document.createElement("div");
    const sentinel90 = document.createElement("div");
    sentinel50.style.cssText = "position:absolute;top:50%;height:1px;width:1px;pointer-events:none";
    sentinel90.style.cssText = "position:absolute;top:90%;height:1px;width:1px;pointer-events:none";
    document.body.appendChild(sentinel50);
    document.body.appendChild(sentinel90);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === sentinel50 && !fired50.current) {
          fired50.current = true;
          onDepth(50);
        }
        if (entry.target === sentinel90 && !fired90.current) {
          fired90.current = true;
          onDepth(90);
        }
      }
    }, { threshold: 0 });

    observer.observe(sentinel50);
    observer.observe(sentinel90);

    return () => {
      observer.disconnect();
      sentinel50.remove();
      sentinel90.remove();
    };
  }, [pageKey]);
}
```

**Step 4: Wire into `src/pages/Index.tsx`**

In `Index.tsx`, after the existing imports, add:

```typescript
import { useScrollDepth } from "@/hooks/useScrollDepth";
import { trackScroll } from "@/lib/xpService";
```

Inside the component body, add:

```typescript
useScrollDepth("index", (depth) => trackScroll("index", depth));
```

**Step 5: Run tests**

```bash
bun run test src/hooks/useScrollDepth.test.ts
# Expected: PASS
```

**Step 6: Commit**

```bash
git add src/hooks/useScrollDepth.ts src/hooks/useScrollDepth.test.ts
git commit -m "feat(xp): useScrollDepth hook — fires 50%/90% scroll XP events"
```

---

## Task 9: Article Read XP — Dwell Timer + Read More Tracking

**Files:**
- Modify: `src/components/NewsCard.tsx`

Read the full file first, then make these changes:

**Step 1: Add dwell timer and Read More tracking to `NewsCard.tsx`**

Add imports at top:
```typescript
import { useEffect, useRef } from "react";
import { trackArticleRead, trackReadMore } from "@/lib/xpService";
```

Inside `NewsCard` component, after the existing state declarations:

```typescript
// 5-second dwell timer for read_summary XP
const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const hasTrackedRead = useRef(false);

useEffect(() => {
  dwellTimer.current = setTimeout(() => {
    if (!hasTrackedRead.current) {
      hasTrackedRead.current = true;
      trackArticleRead(news.sourceUrl);
    }
  }, 5000);
  return () => { if (dwellTimer.current) clearTimeout(dwellTimer.current); };
}, [news.sourceUrl]);
```

Find the "Read More" / external link button in the JSX. It will be an `<a>` or `<Button>` that opens `news.sourceUrl`. Add an `onClick` handler:

```typescript
onClick={() => trackReadMore(news.sourceUrl)}
```

**Step 2: Article combo tracking in `src/components/NewsFeed.tsx`**

Read `NewsFeed.tsx` first. Add a session counter for unique articles read:

```typescript
import { useRef, useCallback } from "react";
import { trackArticleCombo } from "@/lib/xpService";

// Inside NewsFeed component:
const readArticlesSession = useRef(new Set<string>());
const comboBonusFired = useRef(false);

const onArticleRead = useCallback((url: string) => {
  readArticlesSession.current.add(url);
  if (readArticlesSession.current.size >= 4 && !comboBonusFired.current) {
    comboBonusFired.current = true;
    trackArticleCombo();
  }
}, []);
```

Pass `onArticleRead` as a prop to `NewsCard` and call it from the dwell timer callback.

**Step 3: Commit**

```bash
git add src/components/NewsCard.tsx src/components/NewsFeed.tsx
git commit -m "feat(xp): article dwell timer (5s), Read More tracking, combo bonus"
```

---

## Task 10: Daily Login Migration

**Files:**
- Modify: `src/lib/profile.ts`

**Step 1: Replace `claimDailyBonus` to use `xpService`**

Find `claimDailyBonus` in `profile.ts` (line ~517). Replace its entire body:

```typescript
export async function claimDailyBonus(userId: string): Promise<number> {
  // Delegate to award-xp edge function via xpService
  const { claimDailyLogin } = await import("./xpService");
  const result = await claimDailyLogin();
  return result?.awarded ?? 0;
}
```

This keeps backward compatibility — existing callers of `claimDailyBonus` still work.

**Step 2: Commit**

```bash
git add src/lib/profile.ts
git commit -m "feat(xp): migrate claimDailyBonus to use award-xp edge function"
```

---

## Task 11: `ReactionBar` Component

**Files:**
- Create: `src/components/ReactionBar.tsx`
- Modify: `src/components/NewsCard.tsx`

**Step 1: Create the component**

```typescript
// src/components/ReactionBar.tsx
import { useState } from "react";
import { trackReaction } from "@/lib/xpService";

const REACTIONS = ["👍", "❤️", "🔥", "😮"] as const;
type Reaction = typeof REACTIONS[number];

interface ReactionBarProps {
  articleUrl: string;
}

export function ReactionBar({ articleUrl }: ReactionBarProps) {
  const [active, setActive] = useState<Reaction | null>(null);

  const handleReact = async (emoji: Reaction) => {
    if (active === emoji) return; // already reacted with this
    setActive(emoji);
    await trackReaction(articleUrl, emoji);
  };

  return (
    <div className="flex items-center gap-1">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
          className={`text-lg px-2 py-0.5 rounded-full transition-colors ${
            active === emoji
              ? "bg-primary/20 scale-110"
              : "hover:bg-secondary"
          }`}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Add to `NewsCard.tsx`**

Add import: `import { ReactionBar } from "./ReactionBar";`

In the card's footer/action area (near the existing Heart button), replace or augment with:

```tsx
<ReactionBar articleUrl={news.sourceUrl} />
```

Remove the existing placeholder Heart button if it was non-functional.

**Step 3: Commit**

```bash
git add src/components/ReactionBar.tsx src/components/NewsCard.tsx
git commit -m "feat(xp): ReactionBar component with 4 emoji reactions"
```

---

## Task 12: `CommentSection` Component

**Files:**
- Create: `src/components/CommentSection.tsx`
- Modify: `src/components/NewsCard.tsx`

**Step 1: Create the component**

```typescript
// src/components/CommentSection.tsx
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trackComment } from "@/lib/xpService";
import { supabase } from "@/integrations/supabase/client";

interface CommentSectionProps {
  articleUrl: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

export function CommentSection({ articleUrl }: CommentSectionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lastSubmitTime = useRef(0);
  const MIN_LENGTH = 20;
  const COOLDOWN_MS = 60_000;

  const loadComments = async () => {
    const { data } = await supabase
      .from("article_interactions")
      .select("id, content, created_at, user_id")
      .eq("article_url", articleUrl)
      .eq("interaction_type", "comment")
      .order("created_at", { ascending: false })
      .limit(20);
    setComments((data ?? []) as Comment[]);
  };

  const handleToggle = () => {
    if (!open) loadComments();
    setOpen((v) => !v);
  };

  const handleSubmit = async () => {
    if (text.length < MIN_LENGTH) return;
    const now = Date.now();
    if (now - lastSubmitTime.current < COOLDOWN_MS) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error } = await supabase.from("article_interactions").upsert({
      article_url: articleUrl, interaction_type: "comment", content: text,
    }, { onConflict: "user_id,article_url,interaction_type" });

    if (!error) {
      lastSubmitTime.current = now;
      setSubmitted(true);
      setText("");
      await trackComment(articleUrl);
      await loadComments();
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={handleToggle} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        💬 Comments {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {!submitted && (
            <div className="space-y-2">
              <Textarea
                placeholder="Share your thoughts… (min 20 characters)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={text.length < MIN_LENGTH || loading}
              >
                Post Comment
              </Button>
              {text.length > 0 && text.length < MIN_LENGTH && (
                <p className="text-xs text-muted-foreground">{MIN_LENGTH - text.length} more characters needed</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="text-sm bg-secondary rounded p-2">{c.content}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to `NewsCard.tsx`** in the footer area:

```typescript
import { CommentSection } from "./CommentSection";
// In JSX, after ReactionBar:
<CommentSection articleUrl={news.sourceUrl} />
```

**Step 3: Commit**

```bash
git add src/components/CommentSection.tsx src/components/NewsCard.tsx
git commit -m "feat(xp): CommentSection with 60s cooldown and XP tracking"
```

---

## Task 13: `XPProgressBar` in Navbar

**Files:**
- Create: `src/components/XPProgressBar.tsx`
- Modify: `src/components/Navbar.tsx`

**Step 1: Create the component**

```typescript
// src/components/XPProgressBar.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { XP_PER_TIER, MAX_TIERS } from "@/lib/xpConstants";

interface XpState {
  tier: number;
  xp_season: number;
  daily_streak: number;
  streak_frozen: boolean;
}

export function XPProgressBar() {
  const [xp, setXp] = useState<XpState | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("tier, xp_season, daily_streak, streak_frozen")
        .eq("id", user.id)
        .single();
      if (data) setXp(data as XpState);
    });
  }, []);

  if (!xp) return null;

  const tierXp = xp.xp_season % XP_PER_TIER;
  const pct = Math.min((tierXp / XP_PER_TIER) * 100, 100);
  const streakIcon = xp.daily_streak >= 30 ? "⚡" : xp.daily_streak >= 14 ? "🔥🔥🔥" : xp.daily_streak >= 7 ? "🔥🔥" : xp.daily_streak >= 3 ? "🔥" : "";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-bold text-primary">T{xp.tier}/{MAX_TIERS}</span>
      <div className="relative w-20 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground">{tierXp}/{XP_PER_TIER}</span>
      {xp.daily_streak > 0 && (
        <span title={`${xp.daily_streak}-day streak${xp.streak_frozen ? " (protected)": ""}`}>
          {streakIcon} {xp.daily_streak}
        </span>
      )}
    </div>
  );
}
```

**Step 2: Add to `Navbar.tsx`**

Add import: `import { XPProgressBar } from "./XPProgressBar";`

Inside the navbar's user-authenticated section (near the Avatar), add:
```tsx
{user && <XPProgressBar />}
```

**Step 3: Commit**

```bash
git add src/components/XPProgressBar.tsx src/components/Navbar.tsx
git commit -m "feat(xp): XPProgressBar in Navbar with tier, XP fill, streak flame"
```

---

## Task 14: `DailyTrivia` Page

**Files:**
- Create: `src/pages/Trivia.tsx`

**Step 1: Create the page**

```typescript
// src/pages/Trivia.tsx
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getTodayTrivia, submitTrivia, type TriviaQuestion } from "@/lib/xpService";

const TIME_PER_QUESTION = 30; // seconds

export default function Trivia() {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [results, setResults] = useState<{ score: number; total: number; results: { correct: boolean; correct_index: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTodayTrivia().then((data) => {
      setLoading(false);
      if (!data) return;
      if ((data as any).already_completed) { setAlreadyDone(true); return; }
      setQuestions(data.questions);
    });
  }, []);

  useEffect(() => {
    if (!questions.length || results) return;
    setTimeLeft(TIME_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { handleNext(-1); return TIME_PER_QUESTION; } // -1 = timeout/no answer
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, questions.length]);

  const handleNext = async (choice: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const newAnswers = [...answers, choice];
    setAnswers(newAnswers);
    setSelected(null);

    if (current + 1 >= questions.length) {
      const res = await submitTrivia(newAnswers);
      setResults(res);
    } else {
      setCurrent((c) => c + 1);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading today's quiz…</div>;
  if (alreadyDone) return <div className="p-8 text-center">You've already completed today's trivia! Come back tomorrow. 🎮</div>;
  if (!questions.length) return <div className="p-8 text-center">No questions available today.</div>;

  if (results) {
    return (
      <div className="max-w-lg mx-auto p-8 space-y-4 text-center">
        <h2 className="text-2xl font-bold">Quiz Complete! 🎉</h2>
        <p className="text-4xl font-bold text-primary">{results.score}/{results.total}</p>
        {results.score === results.total && <p className="text-green-500 font-semibold">Perfect score! +50 bonus XP 🏆</p>}
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q.id} className={`flex items-center gap-2 text-sm text-left p-2 rounded ${results.results[i].correct ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <span>{results.results[i].correct ? "✅" : "❌"}</span>
              <span>{q.question}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const q = questions[current];
  return (
    <div className="max-w-lg mx-auto p-8 space-y-6">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {current + 1}/{questions.length}</span>
        <span className={timeLeft <= 10 ? "text-red-500 font-bold" : ""}>{timeLeft}s</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(timeLeft / TIME_PER_QUESTION) * 100}%` }} />
      </div>
      <p className="text-lg font-semibold">{q.question}</p>
      <div className="grid grid-cols-1 gap-3">
        {q.options.map((opt, i) => (
          <Button
            key={i}
            variant={selected === i ? "default" : "outline"}
            onClick={() => setSelected(i)}
            className="text-left justify-start h-auto whitespace-normal py-3"
          >
            <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
          </Button>
        ))}
      </div>
      <Button onClick={() => handleNext(selected ?? -1)} disabled={selected === null} className="w-full">
        {current + 1 === questions.length ? "Submit Quiz" : "Next Question"}
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/Trivia.tsx
git commit -m "feat(trivia): DailyTrivia page with 30s timer, AI questions, XP on submit"
```

---

## Task 15: `PredictionCard` in RightSidebar

**Files:**
- Create: `src/components/PredictionCard.tsx`
- Modify: `src/components/RightSidebar.tsx`

**Step 1: Create the component**

```typescript
// src/components/PredictionCard.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type EsportsMatch } from "@/lib/pandascore";
import { submitPrediction } from "@/lib/xpService";

interface PredictionCardProps {
  match: EsportsMatch;
}

export function PredictionCard({ match }: PredictionCardProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Lock predictions 5 minutes before match
  const isLocked = match.status !== "not_started" || (
    match.begin_at
      ? new Date(match.begin_at).getTime() - Date.now() < 5 * 60 * 1000
      : false
  );

  const handlePredict = async (team: string) => {
    if (isLocked || submitted) return;
    setChosen(team);
    await submitPrediction(match.id, team);
    setSubmitted(true);
  };

  return (
    <div className="border rounded-md p-3 space-y-2 text-sm">
      <p className="text-xs text-muted-foreground font-medium">🔮 Predict the winner</p>
      <p className="text-xs text-muted-foreground">{match.tournament} · {match.gameLabel}</p>
      <div className="flex gap-2">
        {[match.team1, match.team2].map((team) => (
          <Button
            key={team}
            size="sm"
            variant={chosen === team ? "default" : "outline"}
            className="flex-1 text-xs h-7"
            disabled={isLocked || submitted}
            onClick={() => handlePredict(team)}
          >
            {team}
          </Button>
        ))}
      </div>
      {submitted && <p className="text-xs text-green-500">✅ Prediction locked in! +25 XP</p>}
      {isLocked && !submitted && <p className="text-xs text-muted-foreground">Predictions closed</p>}
    </div>
  );
}
```

**Step 2: Add to `RightSidebar.tsx`** in the upcoming matches section

Add import: `import { PredictionCard } from "./PredictionCard";`

In the upcoming matches loop, after each match's display, add:

```tsx
<PredictionCard match={match} />
```

**Step 3: Commit**

```bash
git add src/components/PredictionCard.tsx src/components/RightSidebar.tsx
git commit -m "feat(xp): PredictionCard on upcoming esports matches"
```

---

## Task 16: `BattlePassPanel` on Profile Page

**Files:**
- Create: `src/components/BattlePassPanel.tsx`
- Modify: `src/pages/Profile.tsx`

**Step 1: Create the component**

```typescript
// src/components/BattlePassPanel.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIER_REWARDS, XP_PER_TIER, MAX_TIERS } from "@/lib/xpConstants";

const ACT_NAMES = ["ACT I", "ACT II", "ACT III", "ACT IV", "ACT V"];

interface BattlePassPanelProps {
  userId: string;
}

export function BattlePassPanel({ userId }: BattlePassPanelProps) {
  const [tier, setTier] = useState(0);
  const [xpSeason, setXpSeason] = useState(0);

  useEffect(() => {
    supabase.from("profiles").select("tier, xp_season").eq("id", userId).single()
      .then(({ data }) => { if (data) { setTier(data.tier); setXpSeason(data.xp_season); } });
  }, [userId]);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Battle Pass — Season 1</h3>
      <p className="text-sm text-muted-foreground">{xpSeason.toLocaleString()} / {(MAX_TIERS * XP_PER_TIER).toLocaleString()} XP</p>

      {ACT_NAMES.map((act, actIdx) => (
        <div key={act} className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{act}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }, (_, i) => {
              const t = actIdx * 5 + i + 1;
              const reward = TIER_REWARDS[t];
              const unlocked = tier >= t;
              const isMilestone = t % 5 === 0;
              return (
                <div
                  key={t}
                  className={`rounded p-2 text-center text-xs border transition-colors ${
                    unlocked
                      ? "bg-primary/20 border-primary text-foreground"
                      : "bg-secondary/50 border-transparent text-muted-foreground"
                  } ${isMilestone ? "ring-1 ring-yellow-400" : ""}`}
                >
                  <div className="font-bold">T{t}</div>
                  <div className="text-[10px] mt-0.5 leading-tight">{reward?.label.split(":")[0]}</div>
                  {unlocked && <div className="text-green-500 text-[10px]">✓</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Add to `Profile.tsx`**

Read `src/pages/Profile.tsx` first. Add import and render `<BattlePassPanel userId={profile.id} />` in an appropriate section.

**Step 3: Commit**

```bash
git add src/components/BattlePassPanel.tsx src/pages/Profile.tsx
git commit -m "feat(xp): BattlePassPanel — 25 tiers grouped by Act on Profile page"
```

---

## Task 17: Leaderboard Page

**Files:**
- Create: `src/pages/Leaderboard.tsx`

**Step 1: Create the page**

```typescript
// src/pages/Leaderboard.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaderEntry {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  xp_season: number;
  tier: number;
}

interface WeeklyEntry {
  user_id: string;
  total_xp: number;
  username: string | null;
}

export default function Leaderboard() {
  const [season, setSeason] = useState<LeaderEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Season leaderboard
      const { data: seasonData } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, xp_season, tier")
        .order("xp_season", { ascending: false })
        .limit(200);
      setSeason((seasonData ?? []) as LeaderEntry[]);

      // Weekly leaderboard — sum XP earned in last 7 days
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: weeklyData } = await supabase
        .from("xp_events")
        .select("user_id, xp_awarded, profiles(username)")
        .gte("created_at", since);

      const byUser: Record<string, { total: number; username: string | null }> = {};
      for (const row of weeklyData ?? []) {
        if (!byUser[row.user_id]) byUser[row.user_id] = { total: 0, username: (row as any).profiles?.username ?? null };
        byUser[row.user_id].total += row.xp_awarded;
      }
      const sorted = Object.entries(byUser)
        .map(([user_id, v]) => ({ user_id, total_xp: v.total, username: v.username }))
        .sort((a, b) => b.total_xp - a.total_xp)
        .slice(0, 50);
      setWeekly(sorted);
      setLoading(false);
    };
    fetchData();
  }, []);

  const rankBadge = (i: number) =>
    i === 0 ? "👑" : i === 1 ? "💎" : i === 2 ? "🥇" : `#${i + 1}`;

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Tabs defaultValue="season">
        <TabsList>
          <TabsTrigger value="season">Season</TabsTrigger>
          <TabsTrigger value="weekly">This Week</TabsTrigger>
        </TabsList>

        <TabsContent value="season" className="space-y-2 mt-4">
          {season.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <span className="w-8 text-center font-bold">{rankBadge(i)}</span>
              <span className="flex-1 font-medium">{entry.display_name ?? entry.username ?? "Unknown"}</span>
              <span className="text-sm text-muted-foreground">Tier {entry.tier}</span>
              <span className="text-sm font-bold text-primary">{entry.xp_season.toLocaleString()} XP</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-2 mt-4">
          {weekly.map((entry, i) => (
            <div key={entry.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <span className="w-8 text-center font-bold">{rankBadge(i)}</span>
              <span className="flex-1 font-medium">{entry.username ?? "Unknown"}</span>
              <span className="text-sm font-bold text-primary">{entry.total_xp.toLocaleString()} XP this week</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/Leaderboard.tsx
git commit -m "feat(xp): Leaderboard page — season top 200 + weekly top 50"
```

---

## Task 18: XPToast + Route Wiring

**Files:**
- Create: `src/hooks/useXpToast.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Navbar.tsx`

**Step 1: Create `useXpToast`**

```typescript
// src/hooks/useXpToast.ts
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  read_summary:       "Read Article",
  read_more:          "Read More",
  article_combo:      "Article Combo!",
  daily_login:        "Daily Login",
  streak_7:           "7-Day Streak!",
  streak_30:          "30-Day Streak!",
  trivia_participate: "Trivia Played",
  trivia_correct:     "Correct Answer!",
  trivia_perfect:     "Perfect Score!",
  predict_submit:     "Prediction Locked",
  predict_correct:    "Prediction Correct!",
  react:              "Reaction",
  comment:            "Comment Posted",
  scroll_50:          "Deep Reader",
  scroll_90:          "Full Read",
};

export function showXpToast(action: string, awarded: number, tierUp?: boolean) {
  if (awarded <= 0) return;
  const label = ACTION_LABELS[action] ?? action;
  toast(`+${awarded} XP — ${label} 🎮`, {
    duration: 2500,
    position: "bottom-right",
  });
  if (tierUp) {
    setTimeout(() => toast.success("🎉 Tier unlocked! Check your Battle Pass.", { duration: 4000 }), 800);
  }
}
```

**Step 2: Integrate toasts into xpService**

Update `src/lib/xpService.ts` — wrap `awardXp` to call `showXpToast` on success:

```typescript
import { showXpToast } from "@/hooks/useXpToast";

async function awardXp(action_type: string, ref_id?: string): Promise<XpResult | null> {
  const { data, error } = await supabase.functions.invoke("award-xp", {
    body: { action_type, ref_id },
  });
  if (error) { console.error(`XP award failed (${action_type}):`, error); return null; }
  const result = data as XpResult;
  if (result.awarded > 0) showXpToast(action_type, result.awarded, result.tier_up);
  return result;
}
```

**Step 3: Add routes to `App.tsx`**

```typescript
import Trivia from "./pages/Trivia";
import Leaderboard from "./pages/Leaderboard";

// Add inside <Routes>:
<Route path="/trivia" element={<Trivia />} />
<Route path="/leaderboard" element={<Leaderboard />} />
```

**Step 4: Add nav links to `Navbar.tsx`**

Add links to `/trivia` and `/leaderboard` in the nav (near existing links):

```tsx
<Link to="/trivia" className="text-sm font-medium hover:text-primary transition-colors">Trivia</Link>
<Link to="/leaderboard" className="text-sm font-medium hover:text-primary transition-colors">Leaderboard</Link>
```

**Step 5: Run full test suite**

```bash
bun run test
# Expected: all tests pass
```

**Step 6: Commit**

```bash
git add src/hooks/useXpToast.ts src/lib/xpService.ts src/App.tsx src/components/Navbar.tsx
git commit -m "feat(xp): XP toasts, /trivia and /leaderboard routes, nav links"
```

---

## Final: Build Verification

```bash
bun run build
# Expected: no TypeScript errors, dist/ created

bun run dev
# Manually verify:
# 1. Login → XP toast appears, streak updates in Navbar
# 2. Read NewsCard for 5s → "+20 XP — Read Article 🎮"
# 3. Click Read More → "+35 XP — Read More 🎮"
# 4. Visit /trivia → quiz loads, submit → score shown
# 5. Visit /leaderboard → season + weekly tabs work
# 6. Upcoming match in sidebar → predict → "+25 XP"
# 7. React to article → "+10 XP"
# 8. Post comment (20+ chars) → "+25 XP"
```

```bash
git add -A
git commit -m "chore: final build verification — Battle Pass XP Season 1 MVP complete"
```
