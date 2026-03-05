# Battle Pass XP System — Design Document
**Date:** 2026-03-05
**Source:** changes.docx (Game Pulse Battle Pass XP System v2.0)
**Status:** Approved

---

## 1. Overview

A 90-day seasonal Battle Pass XP system for Pixel Pulse that rewards users for reading, engaging, predicting, and returning daily. 25 tiers at 1,000 XP each (flat). No premium track. 7 XP sources with a 400 XP/day hard cap (streak bonuses exempt).

---

## 2. XP Sources & Values

### Priority ① — Reading (core)
| Action | Base XP | Daily Limit | Streak Mult? |
|--------|---------|-------------|--------------|
| Read Article Summary (5s dwell) | 20 XP | 10× / day | ✅ |
| Click Read More (external) | 35 XP | 8× / day | ✅ |
| Article Combo Bonus (4+ unique/session) | +40 XP | 1× / day | ❌ |

### Priority ② — Loyalty (login + streaks)
| Action | XP | Frequency | Cap? |
|--------|-----|-----------|------|
| Daily Login | 50 XP | 1× / day | Yes |
| 7-Day Streak Bonus | 200 XP | 1× / week | **No** |
| 30-Day Streak Bonus | 600 XP | 1× / month | **No** |
| Season Start Boost | 150 XP | Once/season | Yes |
| Onboarding Boost (Days 1–3) | 1.5× all XP | New users | Yes (cap-capped) |

### Priority ③ — Trivia
| Action | Base XP | Daily Limit |
|--------|---------|-------------|
| Trivia Participation | 30 XP | 1× / day |
| Correct Answer Bonus | 15 XP each | 5 answers max (75 XP) |
| Perfect Score Bonus | +50 XP | 1× / day |
| Trivia Streak (7 days) | +100 XP | 1× / week |

### Priority ④ — Predictions
| Action | Base XP | Daily Limit |
|--------|---------|-------------|
| Submit Prediction | 25 XP | 3× / day |
| Correct Prediction | +60 XP | 3× / day |
| Prediction Streak (5 correct) | +150 XP | Unlimited |
| First Prediction of Season | 100 XP | Once |

### Priority ⑤ — Social
| Action | Base XP | Daily Limit |
|--------|---------|-------------|
| React to Article | 10 XP | 1× per article |
| Comment (min 20 chars) | 25 XP | 5× / day |
| Receive 5 Upvotes | +20 XP | 3× / day |

### Priority ⑥ — Scroll
| Action | Base XP | Daily Limit |
|--------|---------|-------------|
| 50% page scroll | 5 XP | 5× / day |
| 90% page scroll | 8 XP | 5× / day |

**Daily Base Cap: 400 XP** (streak bonuses bypass this)

---

## 3. Streak Multiplier (Reading Only)

| Consecutive Active Days | Multiplier |
|------------------------|-----------|
| Day 1–2 | 1.0× |
| Day 3–6 | 1.2× |
| Day 7–13 | 1.5× |
| Day 14–29 | 1.75× |
| Day 30+ | 2.0× (max) |

**Active day threshold:** ≥50 XP earned.
**Grace period:** 1 missed day does NOT break streak (max 1 freeze per 14-day rolling window).

---

## 4. Season & Tier Structure

- **Season length:** 90 days
- **Tiers:** 25 (flat 1,000 XP each)
- **Max season XP:** 25,000
- **Acts:** 5 Acts of 5 tiers each (Act milestones at Tiers 5, 10, 15, 20, 25)

Key milestone rewards: coupons at Tiers 3, 5, 8, 10, 13, 15, 18, 20, 23, 25. Season Champion at Tier 25 = 40% all-partner coupon bundle + permanent badge.

---

## 5. Database Schema

### Additions to `profiles` table
```sql
xp_today          INTEGER DEFAULT 0        -- resets nightly UTC; capped at 400
xp_today_reset_date DATE                   -- last reset date
xp_season         INTEGER DEFAULT 0        -- drives tier; resets each season
tier              INTEGER DEFAULT 0        -- 0-25; denormalized from xp_season/1000
streak_frozen     BOOLEAN DEFAULT FALSE
freeze_window_start DATE
last_active_day   DATE
```
Existing `xp` column → repurposed as **xp_lifetime** (never resets).
Existing `daily_streak` → kept as streak display count.
Existing `level` → deprecated in favor of `tier`.

### New Tables

**`xp_events`** — audit log + dedup key
```sql
id UUID PK, user_id UUID FK, action_type TEXT, ref_id TEXT,
xp_awarded INTEGER, multiplier_applied NUMERIC(4,2),
created_at TIMESTAMPTZ
-- UNIQUE INDEX on (user_id, action_type, ref_id, created_at::date)
```

**`seasons`**
```sql
id INTEGER PK, name TEXT, start_date DATE, end_date DATE, is_active BOOLEAN
```

**`trivia_questions`**
```sql
id UUID PK, question TEXT, options JSONB, correct_index INTEGER,
topic TEXT, generated_at TIMESTAMPTZ
```

**`trivia_attempts`** — 1 per user per day, locked on first submit
```sql
id UUID PK, user_id UUID FK, quiz_date DATE,
questions_json JSONB, answers_json JSONB (null until submitted),
score INTEGER, xp_awarded INTEGER, completed_at TIMESTAMPTZ
UNIQUE(user_id, quiz_date)
```

**`predictions`**
```sql
id UUID PK, user_id UUID FK, match_id INTEGER,
predicted_team TEXT, is_correct BOOLEAN (null until resolved),
xp_participation INTEGER, xp_bonus INTEGER,
created_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ
UNIQUE(user_id, match_id)
```

**`article_reads`** — dedup for read_summary + read_more
```sql
PRIMARY KEY (user_id, article_url, action_type, read_date)
```

**`article_interactions`** — reactions + comments (1 of each per user per article)
```sql
id UUID PK, user_id UUID FK, article_url TEXT,
interaction_type TEXT ('react' | 'comment'),
content TEXT, upvote_count INTEGER, created_at TIMESTAMPTZ
UNIQUE(user_id, article_url, interaction_type)
```

**`user_rewards`** — tier rewards per season
```sql
id UUID PK, user_id UUID FK, season_id INTEGER FK, tier INTEGER,
reward_type TEXT, reward_value TEXT, claimed_at TIMESTAMPTZ, redeemed_at TIMESTAMPTZ
```

**`user_titles`**
```sql
user_id UUID PK FK, active_title TEXT, unlocked_titles TEXT[]
```

---

## 6. Edge Functions (Supabase)

### `award-xp` (central choke point)
- **Auth:** JWT (user inferred from token)
- **Input:** `{ action_type, ref_id? }`
- **Logic:**
  1. Look up base XP from XP constants
  2. Dedup check via `xp_events` unique index — reject if duplicate
  3. Apply streak multiplier (read_summary, read_more only)
  4. Apply onboarding 1.5× boost if days_since_signup ≤ 3
  5. Enforce 400 XP daily cap (skip for streak_7, streak_30)
  6. Write to `xp_events`, update `profiles`
  7. `checkTierUp` — insert `user_rewards`, trigger notification
  8. `updateStreak` — check last_active_day, freeze logic
- **Output:** `{ awarded, xp_today, xp_season, xp_lifetime, tier, streak_count, tier_up? }`

### `generate-trivia`
- Calls OpenRouter (already configured) for 5 gaming trivia Qs in JSON
- Rotates questions: excludes any shown to user in last 14 days
- Saves to `trivia_questions`, creates today's `trivia_attempts` row (answers null)
- Returns questions (no correct answers exposed)

### `resolve-predictions`
- **Auth:** Admin API key header
- **Input:** `{ match_id, winning_team }`
- Updates `predictions.is_correct` for all rows matching `match_id`
- Awards `correct_prediction` bonus XP to correct predictors via `award-xp` logic
- Cancelled match handling: refunds `xp_participation` via negative `xp_events` row

---

## 7. TypeScript Service Layer

**`src/lib/xpService.ts`** — thin wrapper calling `award-xp` edge function:

| Export | Trigger | Notes |
|--------|---------|-------|
| `trackArticleRead(url)` | 5s dwell on NewsCard | Client timer; server deduplicates |
| `trackReadMore(url)` | "Read More" click | Before opening external link |
| `trackArticleCombo()` | After 4th unique article in session | Client counts; server deduplicates |
| `claimDailyLogin()` | First page load of day | Replaces existing `claimDailyBonus` |
| `submitTrivia(quizDate, answers[])` | Quiz submit | Returns score + XP breakdown |
| `submitPrediction(matchId, team)` | Prediction submit | Locked 5min before match start |
| `trackReaction(url, emoji)` | Reaction click | 1 per article per day |
| `trackComment(url, text)` | Comment submit | Min 20 chars, 60s cooldown enforced client-side |
| `trackScroll(page, depth)` | IntersectionObserver (50%/90%) | Fires once per unique page |

---

## 8. Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `XPProgressBar` | Navbar | Tier badge, XP fill bar, streak flame 🔥 |
| `BattlePassPanel` | Profile page | 25 tiers grouped by Act, claim button |
| `DailyTrivia` | `/trivia` route | 5 Qs, 30s timer per Q, score + XP result |
| `PredictionCard` | RightSidebar (extends esports widget) | Pick winner on upcoming match |
| `CommentSection` | NewsCard expanded view | Text input + comment list |
| `ReactionBar` | NewsCard | 👍❤️🔥😮, shows counts |
| `LeaderboardPage` | `/leaderboard` route | Season top 200 + weekly top 50 tabs |
| `XPToast` | Global | Sonner toast: "+35 XP — Read More 🎮" |
| `useScrollDepth` hook | Index page | IntersectionObserver scroll XP |

### Existing file changes
- `NewsCard.tsx` — 5s dwell timer, `ReactionBar`, expandable `CommentSection`
- `RightSidebar.tsx` — extend esports widget with `PredictionCard`
- `Navbar.tsx` — add `XPProgressBar`
- `src/lib/profile.ts` — `claimDailyBonus` wraps new `claimDailyLogin`
- `App.tsx` — add `/trivia` and `/leaderboard` routes

---

## 9. Leaderboard

- **Season leaderboard:** top 200 by `xp_season`, queried from `profiles`
- **Weekly leaderboard:** top 50 by sum of `xp_events.xp_awarded` in last 7 days
- **Prediction sub-leaderboard:** top predictors by correct count from `predictions`
- Weekly top 3 bonus XP: 150 / 100 / 75 (above daily cap)

---

## 10. Anti-Abuse Summary

| Layer | Mechanism |
|-------|-----------|
| Daily XP cap | 400 XP hard limit in `award-xp`, checked before every award |
| Action dedup | Unique index on `xp_events(user_id, action_type, ref_id, date)` |
| Article read dwell | 5s client timer; server checks `article_reads` for same-day dup |
| Comment cooldown | 60s enforced client-side + server checks `created_at` of last comment |
| Trivia lock | `trivia_attempts.completed_at` set on first submit; no retry |
| Prediction lock | Locked 5min before match start via `begin_at` timestamp check |
| Trivia rotation | Questions not repeated within 14 days per user |

---

## 11. Migration from Existing System

- Existing `xp` column → becomes `xp_lifetime`; no data loss
- Existing `daily_streak` → populates `streak_count`; kept as-is
- Existing `claimDailyBonus` → replaced by `claimDailyLogin` (new flow via `award-xp`)
- Existing `level` (100 XP/level) → UI switches to `tier` (1000 XP/tier); `level` column kept but ignored
- Existing users start Season 1 at `xp_season = 0`, `tier = 0`
