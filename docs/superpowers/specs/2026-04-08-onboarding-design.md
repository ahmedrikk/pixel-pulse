# Onboarding Flow Design — Game Pulse

**Date:** 2026-04-08  
**Source spec:** `GamePulse_Onboarding_Guide_v1.0.docx`  
**Status:** Approved

---

## Overview

4-step linear onboarding flow triggered on first login. Inspired by X/Instagram: fast, visual, gamified, required (no step can be skipped). Completes in under 2 minutes. Awards +50 XP on completion (exempt from daily cap).

**Routes:**
```
/onboarding/step-1   Identity
/onboarding/step-2   Platforms & Skill
/onboarding/step-3   Games & Genres
/onboarding/step-4   Confirmation
```

---

## Architecture Decisions

### 1. Route Guard (SPA adaptation)
The original spec was written for Next.js middleware. We use React Router v6, so:
- `<OnboardingGuard>` component wraps all protected routes in `App.tsx`
- On mount: checks `isAuthenticated` + `profile.onboarding_completed`
- If authenticated but not completed → redirect to `/onboarding/step-${profile.onboarding_step}`
- If `onboarding_completed` → accessing `/onboarding/*` redirects to `/`
- Unauthenticated users skip the guard entirely (onboarding only runs post-auth)

### 2. Data Persistence
No API endpoints needed — direct Supabase upserts from each step component.

Each step's Continue button:
1. Validates locally
2. Upserts to `profiles` (sets fields + increments `onboarding_step`)
3. Navigates to next step

Step 4 page load calls `xpService.awardXP('profile_complete')` — already idempotent via duplicate action check.

### 3. Database — profiles table additions

New migration adds to `profiles`:

```sql
onboarding_completed     boolean   DEFAULT false
onboarding_step          integer   DEFAULT 1
onboarding_completed_at  timestamptz
platforms                text[]
skill_level              text      DEFAULT 'casual'
fav_game_ids             text[]
fav_genres               text[]
avatar_type              text      DEFAULT 'initials'  -- 'upload' | 'preset' | 'initials'
avatar_initials          text
avatar_color             text
```

### 4. Avatar Presets
**Dicebear pixel-art with named seeds** — 24 curated gaming character names (no image assets needed):
`knight, mage, sniper, racer, ninja, wizard, ranger, rogue, paladin, berserker, archer, bard, druid, monk, warlock, samurai, pirate, viking, assassin, guardian, mercenary, hunter, scout, shaman`

URL pattern: `https://api.dicebear.com/9.x/pixel-art/svg?seed={name}`

Initials avatar: colored circle, color derived from `username.charCodeAt(0) % 8` → one of 8 fixed colors.

### 5. Game Search
- **Popular list (Step 3 default):** Static array of 20 games seeded in component (no DB call needed — games table may not have all 20). Uses cover images from Unsplash or game cover URLs.
- **Search:** Queries Supabase `games` table: `ilike('name', '%query%')` with limit 10. Falls back to empty results gracefully.

### 6. Username Availability Check
Direct Supabase query on `profiles`: `.eq('username', value).select('id')`, debounced at 400ms. Returns available/taken/checking state.

---

## Step Specifications

### Step 1 — Identity
**Fields:** Avatar (3 options) · Display name (2–30 chars) · Username (3–20 chars, auto-gen, unique) · Bio (optional, 120 chars)  
**Gate:** `displayName.length >= 2 && usernameAvailable && avatarChosen`  
**Avatar options:**
- Upload photo (JPG/PNG/WebP, max 5MB, crop to 1:1) → uploads to Supabase Storage
- Choose avatar → modal with 24 Dicebear pixel-art avatars
- Use initials → pre-selected default (unblocks Continue from the start)

### Step 2 — Platforms & Skill Level
**Fields:** Platforms (multi-select, min 1) · Skill level (single-select, 'Casual' pre-selected)  
**Gate:** `selectedPlatforms.length >= 1`  
**Platforms:** PC/Steam · PlayStation · Xbox · Nintendo · Mobile · Cloud Gaming

**Skill levels:** Just for fun · Casual (default) · Competitive · Semi-pro

### Step 3 — Games & Genres
**Fields:** Games (searchable, min 3 required) · Genre tags (multi-select, no minimum)  
**Gate:** `selectedGames.length >= 3`  
**Default list:** 20 pre-populated games (Minecraft, Fortnite, CoD, Valorant, LoL, Elden Ring, etc.)  
**Search:** Debounced 300ms → Supabase `games` table `ilike` query  
**Genres (8):** RPG · FPS · Strategy · Sports · Horror · Indie · MOBA · Sim

### Step 4 — Confirmation
**No form fields.** Celebration screen.  
**On page load:** Call `xpService.awardXP('profile_complete', userId)` + set `onboarding_completed = true` + `onboarding_completed_at = now()`  
**Shows:** Confetti · "+50 XP" pill · Profile summary card (username, platforms, games, genres, Tier 1 · 50 XP) · "Go to your feed →" button

---

## Component Structure

```
src/
  pages/
    onboarding/
      Step1Identity.tsx
      Step2Platforms.tsx
      Step3Games.tsx
      Step4Confirmation.tsx
      OnboardingLayout.tsx      ← shared layout (desktop two-panel / mobile single-col)
  components/onboarding/
    AvatarPicker.tsx            ← upload + Dicebear grid + initials
    PlatformCard.tsx
    GameRow.tsx                 ← single game row (checkbox + thumbnail + name)
    GameSearchInput.tsx         ← debounced search → Supabase
    SkillLevelTag.tsx
    GenreChip.tsx
    XPCallout.tsx               ← "+50 XP awaits" pill shown on steps 1–3
    DesktopLeftPanel.tsx        ← dark purple panel with step list
    StepProgressBar.tsx         ← 4-segment mobile progress bar
  lib/
    onboardingService.ts        ← saveStep1(), saveStep2(), saveStep3(), completeOnboarding()
  hooks/
    useOnboardingState.ts       ← persists step data across step navigation in sessionStorage
```

---

## Layout

### Desktop (≥768px)
Two-panel split:
- **Left panel:** 400px fixed, `#3C3489` dark purple, persistent across all steps. Shows: GAME PULSE wordmark · Season badge · Vertical step list (completed ✓ / active / upcoming dim) · "+50 XP awaits" callout at bottom.
- **Right panel:** Flex 1, white, max-width 480px form centered. Slide animation between steps (in from right, out to left, 0.22s ease).

### Mobile (<768px)
Single column, full screen:
- 4-segment progress bar at top (3px height)
- Scrollable content area
- Sticky Continue button at bottom (full width)
- Back button top-left (steps 2–3 only)

---

## Validation Rules (summary)

| Step | Field | Required | Rule |
|------|-------|----------|------|
| 1 | Avatar | YES | Initials pre-selected — never blocks |
| 1 | Display name | YES | 2–30 chars |
| 1 | Username | YES | 3–20 chars, unique |
| 1 | Bio | NO | Max 120 chars |
| 2 | Platforms | YES | Min 1 selected |
| 2 | Skill level | NO | Casual pre-selected |
| 3 | Games | YES | Min 3 selected |
| 3 | Genres | NO | No minimum |
| 4 | — | — | Always enabled |

---

## XP Award

```ts
// xpConstants.ts — add inside XP_TABLE_DATA object (as const):
profile_complete: 50

// Also add to DAILY_LIMITS — exempt (no limit key = uncapped):
// No entry needed; omitting from DAILY_LIMITS means uncapped.

// Step4Confirmation.tsx — on mount:
if (!alreadyAwarded) {
  await awardXP('profile_complete', userId)
  await supabase.from('profiles').update({
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  }).eq('id', userId)
}
```

The existing `awardXP` in `xpService.ts` handles deduplication — calling it twice for the same action+user on the same day returns `duplicate: true` without double-awarding.

**Supabase Storage:** Avatar photo uploads require an `avatars` storage bucket. Migration must create it (or verify it exists) with public read access. File path: `avatars/{userId}/{timestamp}.{ext}`.

---

## Migration Plan

1. Add onboarding columns to `profiles` table (migration file)
2. Add `profile_complete` action to `XP_TABLE` in `xpConstants.ts`
3. Add `/onboarding/*` routes to `App.tsx` (outside `<OnboardingGuard>` wrapper)
4. Build components bottom-up: shared → steps → layout → guard
5. Wire `OnboardingGuard` into existing protected routes
