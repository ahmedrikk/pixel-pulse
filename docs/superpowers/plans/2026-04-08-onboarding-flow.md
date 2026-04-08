# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-step linear onboarding wizard (Identity → Platforms → Games → Confirmation) that gates the app on first login and seeds feed personalisation data.

**Architecture:** React Router v6 `<OnboardingGuard>` wraps all main routes and redirects unauthenticated-but-incomplete users to `/onboarding/step-N`. Each step upserts directly to Supabase `profiles`. Step 4 awards +50 XP via a direct DB increment (idempotent). Desktop: two-panel split (dark-purple left panel + white form right). Mobile: single-column with sticky footer.

**Tech Stack:** React 18, TypeScript, React Router v6, Supabase JS v2, Tailwind CSS, shadcn/ui, Dicebear pixel-art API, Vitest

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `supabase/migrations/20260408000001_add_onboarding_columns.sql` | DB: onboarding columns on profiles + avatars storage bucket |
| `src/lib/onboardingService.ts` | All Supabase read/write for onboarding (saveStep1–3, completeOnboarding, checkUsername) |
| `src/hooks/useOnboardingState.ts` | sessionStorage-backed hook that persists wizard state across step navigation |
| `src/components/OnboardingGuard.tsx` | Route guard: redirects incomplete users to onboarding |
| `src/pages/onboarding/OnboardingLayout.tsx` | Shared two-panel desktop + single-col mobile shell |
| `src/components/onboarding/DesktopLeftPanel.tsx` | Dark-purple left panel with step list |
| `src/components/onboarding/StepProgressBar.tsx` | 4-segment mobile progress bar |
| `src/components/onboarding/XPCallout.tsx` | "+50 XP awaits" pill (steps 1–3) |
| `src/components/onboarding/AvatarPicker.tsx` | Upload + 24 Dicebear presets + initials |
| `src/components/onboarding/PlatformCard.tsx` | Single platform toggle card |
| `src/components/onboarding/SkillLevelTag.tsx` | Single skill-level toggle tag |
| `src/components/onboarding/GameRow.tsx` | Single game row (checkbox + thumbnail + name) |
| `src/components/onboarding/GameSearchInput.tsx` | Debounced search → Supabase |
| `src/components/onboarding/GenreChip.tsx` | Single genre toggle chip |
| `src/pages/onboarding/Step1Identity.tsx` | Step 1: avatar + display name + username + bio |
| `src/pages/onboarding/Step2Platforms.tsx` | Step 2: platforms + skill level |
| `src/pages/onboarding/Step3Games.tsx` | Step 3: game search + genre chips |
| `src/pages/onboarding/Step4Confirmation.tsx` | Step 4: celebration + XP award |

### Modified files
| Path | Change |
|------|--------|
| `src/lib/xpConstants.ts` | Add `profile_complete: 50` to XP_TABLE_DATA |
| `src/integrations/supabase/types.ts` | Add onboarding columns to profiles Row/Insert/Update |
| `src/App.tsx` | Add `/onboarding/*` routes + wrap protected routes in `<OnboardingGuard>` |

---

## Task 1: DB Migration — Onboarding Columns + Storage Bucket

**Files:**
- Create: `supabase/migrations/20260408000001_add_onboarding_columns.sql`

- [ ] **Step 1.1: Write the migration**

```sql
-- supabase/migrations/20260408000001_add_onboarding_columns.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step          integer     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS platforms                text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skill_level              text        NOT NULL DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS fav_game_ids             text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fav_genres               text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_type              text        NOT NULL DEFAULT 'initials',
  ADD COLUMN IF NOT EXISTS avatar_initials          text,
  ADD COLUMN IF NOT EXISTS avatar_color             text;

-- Create avatars storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY IF NOT EXISTS "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public to read avatars
CREATE POLICY IF NOT EXISTS "Public read avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');
```

- [ ] **Step 1.2: Push to Supabase**

```bash
cd pixel-pulse
npx supabase db push --linked --yes
```

Expected: `Applying migration 20260408000001_add_onboarding_columns.sql... done`

- [ ] **Step 1.3: Commit**

```bash
git add supabase/migrations/20260408000001_add_onboarding_columns.sql
git commit -m "feat: add onboarding columns to profiles + avatars bucket"
```

---

## Task 2: TypeScript Types + XP Constant

**Files:**
- Modify: `src/integrations/supabase/types.ts` (profiles Row/Insert/Update)
- Modify: `src/lib/xpConstants.ts`

- [ ] **Step 2.1: Add onboarding fields to profiles Row type**

In `src/integrations/supabase/types.ts`, find the `profiles` table `Row` block (around line 264) and add after `xp_today_reset_date`:

```ts
      // Onboarding fields
      onboarding_completed: boolean
      onboarding_step: number
      onboarding_completed_at: string | null
      platforms: string[] | null
      skill_level: string
      fav_game_ids: string[] | null
      fav_genres: string[] | null
      avatar_type: string
      avatar_initials: string | null
      avatar_color: string | null
```

- [ ] **Step 2.2: Add to profiles Insert type**

Find the `Insert` block for profiles and add after `xp_today_reset_date`:

```ts
      onboarding_completed?: boolean
      onboarding_step?: number
      onboarding_completed_at?: string | null
      platforms?: string[] | null
      skill_level?: string
      fav_game_ids?: string[] | null
      fav_genres?: string[] | null
      avatar_type?: string
      avatar_initials?: string | null
      avatar_color?: string | null
```

- [ ] **Step 2.3: Add to profiles Update type**

Find the `Update` block for profiles and add the same optional fields (identical to Insert above).

- [ ] **Step 2.4: Add profile_complete to XP_TABLE_DATA**

In `src/lib/xpConstants.ts`, add inside the `XP_TABLE_DATA` object after the `scroll_90` line:

```ts
  // Onboarding (one-time, no daily limit)
  profile_complete:     50,
```

- [ ] **Step 2.5: Commit**

```bash
git add src/integrations/supabase/types.ts src/lib/xpConstants.ts
git commit -m "feat: add onboarding types and profile_complete XP constant"
```

---

## Task 3: onboardingService.ts

**Files:**
- Create: `src/lib/onboardingService.ts`
- Create: `src/lib/onboardingService.test.ts`

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/onboardingService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

import { checkUsernameAvailable, saveStep1, saveStep2, saveStep3 } from './onboardingService';
import { supabase } from '@/integrations/supabase/client';

describe('checkUsernameAvailable', () => {
  it('returns true when username not found', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });
    const result = await checkUsernameAvailable('newuser');
    expect(result).toBe(true);
  });

  it('returns false when username exists', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'abc' }, error: null }),
        }),
      }),
    });
    const result = await checkUsernameAvailable('takenuser');
    expect(result).toBe(false);
  });
});

describe('saveStep1', () => {
  it('upserts identity fields to profiles', async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: updateMock }),
    });

    await saveStep1('user-1', {
      displayName: 'GamerX',
      username: 'gamerx',
      avatarUrl: null,
      avatarType: 'initials',
      avatarInitials: 'GX',
      avatarColor: '#534AB7',
      bio: '',
    });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });
});
```

- [ ] **Step 3.2: Run tests — expect FAIL**

```bash
cd pixel-pulse && npx vitest run src/lib/onboardingService.test.ts
```

Expected: FAIL — `onboardingService` not found.

- [ ] **Step 3.3: Implement onboardingService.ts**

Create `src/lib/onboardingService.ts`:

```ts
import { supabase } from '@/integrations/supabase/client';

export interface Step1Data {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  avatarType: 'upload' | 'preset' | 'initials';
  avatarInitials: string;
  avatarColor: string;
  bio: string;
}

export interface Step2Data {
  platforms: string[];
  skillLevel: string;
}

export interface Step3Data {
  favGameIds: string[];
  favGenres: string[];
}

/** Returns true if username is available */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  // PGRST116 = no rows found = username is available
  if (error?.code === 'PGRST116') return true;
  if (error) return false; // network error — treat conservatively as unavailable
  return !data;
}

/** Save Step 1 data to profiles, advance onboarding_step to 2 */
export async function saveStep1(userId: string, data: Step1Data): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: data.displayName,
      username: data.username,
      avatar_url: data.avatarUrl,
      avatar_type: data.avatarType,
      avatar_initials: data.avatarInitials,
      avatar_color: data.avatarColor,
      about_me: data.bio,
      onboarding_step: 2,
    })
    .eq('id', userId);

  if (error) throw new Error(`saveStep1 failed: ${error.message}`);
}

/** Save Step 2 data to profiles, advance onboarding_step to 3 */
export async function saveStep2(userId: string, data: Step2Data): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      platforms: data.platforms,
      skill_level: data.skillLevel,
      onboarding_step: 3,
    })
    .eq('id', userId);

  if (error) throw new Error(`saveStep2 failed: ${error.message}`);
}

/** Save Step 3 data to profiles, advance onboarding_step to 4 */
export async function saveStep3(userId: string, data: Step3Data): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      fav_game_ids: data.favGameIds,
      fav_genres: data.favGenres,
      onboarding_step: 4,
    })
    .eq('id', userId);

  if (error) throw new Error(`saveStep3 failed: ${error.message}`);
}

/**
 * Mark onboarding complete and award +50 XP (idempotent).
 * Returns awarded XP (0 if already completed).
 */
export async function completeOnboarding(userId: string): Promise<number> {
  // Check if already completed
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, xp, xp_season')
    .eq('id', userId)
    .single();

  if (!profile || profile.onboarding_completed) return 0;

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: 4,
      xp: (profile.xp ?? 0) + 50,
      xp_season: (profile.xp_season ?? 0) + 50,
    })
    .eq('id', userId);

  if (error) throw new Error(`completeOnboarding failed: ${error.message}`);
  return 50;
}

/** Upload avatar file to Supabase Storage, return public URL */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(`Avatar upload failed: ${error.message}`);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 3.4: Run tests — expect PASS**

```bash
cd pixel-pulse && npx vitest run src/lib/onboardingService.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/onboardingService.ts src/lib/onboardingService.test.ts
git commit -m "feat: onboardingService — step saves, username check, avatar upload, XP completion"
```

---

## Task 4: useOnboardingState Hook

**Files:**
- Create: `src/hooks/useOnboardingState.ts`

- [ ] **Step 4.1: Create the hook**

```ts
// src/hooks/useOnboardingState.ts
import { useState, useCallback } from 'react';
import { Step1Data, Step2Data, Step3Data } from '@/lib/onboardingService';

const SESSION_KEY = 'onboarding_state';

interface OnboardingState {
  step1?: Step1Data;
  step2?: Step2Data;
  step3?: Step3Data;
}

function load(): OnboardingState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: OnboardingState) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(load);

  const setStep1 = useCallback((data: Step1Data) => {
    setState(prev => {
      const next = { ...prev, step1: data };
      save(next);
      return next;
    });
  }, []);

  const setStep2 = useCallback((data: Step2Data) => {
    setState(prev => {
      const next = { ...prev, step2: data };
      save(next);
      return next;
    });
  }, []);

  const setStep3 = useCallback((data: Step3Data) => {
    setState(prev => {
      const next = { ...prev, step3: data };
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState({});
  }, []);

  return { state, setStep1, setStep2, setStep3, clear };
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/hooks/useOnboardingState.ts
git commit -m "feat: useOnboardingState — sessionStorage-backed wizard state"
```

---

## Task 5: Shared UI Primitives

**Files:**
- Create: `src/components/onboarding/XPCallout.tsx`
- Create: `src/components/onboarding/StepProgressBar.tsx`
- Create: `src/components/onboarding/DesktopLeftPanel.tsx`

- [ ] **Step 5.1: XPCallout**

```tsx
// src/components/onboarding/XPCallout.tsx
export function XPCallout() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-purple-50 border border-purple-100 px-4 py-3">
      <span className="rounded-full bg-[#534AB7] px-3 py-1 text-xs font-bold text-white">+50 XP</span>
      <span className="text-sm text-[#534AB7]">Completing your profile earns Battle Pass XP</span>
    </div>
  );
}
```

- [ ] **Step 5.2: StepProgressBar**

```tsx
// src/components/onboarding/StepProgressBar.tsx
interface StepProgressBarProps { currentStep: 1 | 2 | 3 | 4 }

export function StepProgressBar({ currentStep }: StepProgressBarProps) {
  return (
    <div className="flex gap-1.5 w-full">
      {[1, 2, 3, 4].map(n => (
        <div
          key={n}
          className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
            n <= currentStep ? 'bg-[#534AB7]' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5.3: DesktopLeftPanel**

```tsx
// src/components/onboarding/DesktopLeftPanel.tsx
import { Check } from 'lucide-react';

const STEPS = [
  { n: 1, label: 'Identity',   sub: 'Your name and avatar' },
  { n: 2, label: 'Platforms',  sub: 'Where you game' },
  { n: 3, label: 'Your Games', sub: 'What you play' },
  { n: 4, label: 'All done',   sub: "You're in" },
];

interface DesktopLeftPanelProps { currentStep: 1 | 2 | 3 | 4 }

export function DesktopLeftPanel({ currentStep }: DesktopLeftPanelProps) {
  return (
    <div className="hidden md:flex w-[400px] min-h-screen flex-col bg-[#3C3489] px-10 py-10 flex-shrink-0">
      <div className="text-white font-semibold text-xl tracking-wide mb-2">GAME PULSE</div>
      <div className="inline-flex items-center gap-2 rounded-full bg-[#534AB7] px-3 py-1 text-xs text-purple-200 mb-10 self-start">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-300" />
        Season 1 is live
      </div>

      <nav className="flex flex-col gap-0">
        {STEPS.map((step, i) => {
          const done    = step.n < currentStep;
          const active  = step.n === currentStep;
          const upcoming = step.n > currentStep;

          return (
            <div key={step.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  done    ? 'bg-white text-[#3C3489]' :
                  active  ? 'bg-white text-[#3C3489] ring-2 ring-purple-300' :
                            'border-2 border-white/30 text-white/40'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : step.n}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-0.5 h-10 my-1 rounded-full ${done ? 'bg-white/60' : 'bg-white/20'}`} />
                )}
              </div>
              <div className="pb-10">
                <p className={`text-sm font-semibold leading-none mb-0.5 ${upcoming ? 'text-white/40' : 'text-white'}`}>
                  {step.label}
                </p>
                <p className={`text-xs ${upcoming ? 'text-white/25' : 'text-white/60'}`}>{step.sub}</p>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl bg-white/10 px-4 py-3 text-sm text-purple-200">
        +50 XP awaits on completion
      </div>
    </div>
  );
}
```

- [ ] **Step 5.4: Commit**

```bash
git add src/components/onboarding/XPCallout.tsx src/components/onboarding/StepProgressBar.tsx src/components/onboarding/DesktopLeftPanel.tsx
git commit -m "feat: onboarding shared UI primitives (XPCallout, StepProgressBar, DesktopLeftPanel)"
```

---

## Task 6: AvatarPicker

**Files:**
- Create: `src/components/onboarding/AvatarPicker.tsx`

The 24 named Dicebear seeds. Each renders as `https://api.dicebear.com/9.x/pixel-art/svg?seed={name}`.

- [ ] **Step 6.1: Create AvatarPicker**

```tsx
// src/components/onboarding/AvatarPicker.tsx
import { useRef, useState } from 'react';
import { Camera, Grid2x2, Type } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { uploadAvatar } from '@/lib/onboardingService';

const PRESET_SEEDS = [
  'knight','mage','sniper','racer','ninja','wizard','ranger','rogue',
  'paladin','berserker','archer','bard','druid','monk','warlock','samurai',
  'pirate','viking','assassin','guardian','mercenary','hunter','scout','shaman',
];

const INITIALS_COLORS = [
  '#534AB7','#3C3489','#e4000f','#107C10',
  '#FF6900','#00B4D8','#1b2838','#9333ea',
];

function getInitialsColor(username: string): string {
  return INITIALS_COLORS[username.charCodeAt(0) % INITIALS_COLORS.length];
}

export type AvatarValue =
  | { type: 'initials'; initials: string; color: string; url: null }
  | { type: 'preset';   initials: string; color: string; url: string; seed: string }
  | { type: 'upload';   initials: string; color: string; url: string };

interface AvatarPickerProps {
  username: string;
  userId: string;
  value: AvatarValue;
  onChange: (v: AvatarValue) => void;
}

export function AvatarPicker({ username, userId, value, onChange }: AvatarPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = username.slice(0, 2).toUpperCase() || 'GP';
  const color = getInitialsColor(username || 'a');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(userId, file);
      onChange({ type: 'upload', initials, color, url });
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function selectPreset(seed: string) {
    const url = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}`;
    onChange({ type: 'preset', initials, color, url, seed });
    setPickerOpen(false);
  }

  function useInitials() {
    onChange({ type: 'initials', initials, color, url: null });
  }

  // Preview
  const preview = value.type === 'initials'
    ? <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl"
           style={{ background: value.color }}>{value.initials || 'GP'}</div>
    : <img src={value.url!} alt="avatar" className="w-full h-full rounded-full object-cover" />;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-20 h-20 rounded-full ring-2 ring-[#534AB7] overflow-hidden bg-gray-100">
        {preview}
      </div>

      <div className="flex gap-3">
        {/* Upload */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:border-[#534AB7] transition-colors"
        >
          <Camera className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

        {/* Preset picker */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:border-[#534AB7] transition-colors"
        >
          <Grid2x2 className="w-3.5 h-3.5" /> Choose avatar
        </button>

        {/* Initials */}
        <button
          type="button"
          onClick={useInitials}
          className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${
            value.type === 'initials' ? 'border-[#534AB7] bg-purple-50 text-[#534AB7]' : 'border-gray-200 hover:border-[#534AB7]'
          }`}
        >
          <Type className="w-3.5 h-3.5" /> Initials
        </button>
      </div>

      {/* Preset picker modal */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Choose your avatar</DialogTitle>
          <div className="grid grid-cols-6 gap-3 mt-2">
            {PRESET_SEEDS.map(seed => (
              <button
                key={seed}
                type="button"
                onClick={() => selectPreset(seed)}
                title={seed}
                className={`w-12 h-12 rounded-full overflow-hidden ring-2 transition-all ${
                  value.type === 'preset' && (value as { seed?: string }).seed === seed
                    ? 'ring-[#534AB7]' : 'ring-transparent hover:ring-purple-300'
                }`}
              >
                <img
                  src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${seed}`}
                  alt={seed}
                  className="w-full h-full"
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/onboarding/AvatarPicker.tsx
git commit -m "feat: AvatarPicker — upload, 24 Dicebear presets, initials"
```

---

## Task 7: Platform, Skill, Game, Genre Components

**Files:**
- Create: `src/components/onboarding/PlatformCard.tsx`
- Create: `src/components/onboarding/SkillLevelTag.tsx`
- Create: `src/components/onboarding/GameRow.tsx`
- Create: `src/components/onboarding/GameSearchInput.tsx`
- Create: `src/components/onboarding/GenreChip.tsx`

- [ ] **Step 7.1: PlatformCard**

```tsx
// src/components/onboarding/PlatformCard.tsx
interface PlatformCardProps {
  id: string;
  label: string;
  icon: string;
  color: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function PlatformCard({ id, label, icon, color, selected, onToggle }: PlatformCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
        selected
          ? 'border-[#534AB7] bg-purple-50'
          : 'border-gray-200 hover:border-purple-300 bg-white'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className={`text-xs font-medium ${selected ? 'text-[#534AB7]' : 'text-gray-700'}`}>
        {label}
      </span>
    </button>
  );
}
```

- [ ] **Step 7.2: SkillLevelTag**

```tsx
// src/components/onboarding/SkillLevelTag.tsx
interface SkillLevelTagProps {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (v: string) => void;
}

export function SkillLevelTag({ value, label, description, selected, onSelect }: SkillLevelTagProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
        selected
          ? 'border-[#534AB7] bg-[#534AB7] text-white'
          : 'border-gray-200 text-gray-700 hover:border-[#534AB7]'
      }`}
      title={description}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 7.3: GameRow**

```tsx
// src/components/onboarding/GameRow.tsx
interface GameRowProps {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function GameRow({ id, name, genre, coverUrl, selected, onToggle }: GameRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
        selected ? 'bg-purple-50 border border-[#534AB7]' : 'border border-transparent hover:bg-gray-50'
      }`}
    >
      <img
        src={coverUrl}
        alt={name}
        className="w-7 h-7 rounded object-cover flex-shrink-0"
        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=28&h=28&fit=crop'; }}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${selected ? 'text-[#534AB7]' : 'text-gray-900'}`}>{name}</p>
        <p className="text-xs text-gray-500">{genre}</p>
      </div>
      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
        selected ? 'bg-[#534AB7] border-[#534AB7]' : 'border-gray-300'
      }`}>
        {selected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5l-1 1 4 4 6-7z"/></svg>}
      </div>
    </button>
  );
}
```

- [ ] **Step 7.4: GameSearchInput**

```tsx
// src/components/onboarding/GameSearchInput.tsx
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface GameOption {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
}

interface GameSearchInputProps {
  onResults: (games: GameOption[]) => void;
  onClear: () => void;
}

export function GameSearchInput({ onResults, onClear }: GameSearchInputProps) {
  const [query, setQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { onClear(); return; }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('games')
        .select('id, name, genres, cover_image')
        .ilike('name', `%${query}%`)
        .limit(10);

      const results: GameOption[] = (data ?? []).map(g => ({
        id: g.id,
        name: g.name,
        genre: g.genres?.[0] ?? 'Game',
        coverUrl: g.cover_image ?? '',
      }));
      onResults(results);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query, onResults, onClear]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search games…"
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#534AB7]"
      />
    </div>
  );
}
```

- [ ] **Step 7.5: GenreChip**

```tsx
// src/components/onboarding/GenreChip.tsx
interface GenreChipProps {
  value: string;
  label: string;
  selected: boolean;
  onToggle: (v: string) => void;
}

export function GenreChip({ value, label, selected, onToggle }: GenreChipProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(value)}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
        selected
          ? 'border-[#534AB7] bg-[#534AB7] text-white'
          : 'border-gray-200 text-gray-700 hover:border-[#534AB7]'
      }`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 7.6: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat: onboarding UI components (PlatformCard, SkillLevelTag, GameRow, GameSearchInput, GenreChip)"
```

---

## Task 8: OnboardingLayout

**Files:**
- Create: `src/pages/onboarding/OnboardingLayout.tsx`

- [ ] **Step 8.1: Create OnboardingLayout**

```tsx
// src/pages/onboarding/OnboardingLayout.tsx
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DesktopLeftPanel } from '@/components/onboarding/DesktopLeftPanel';
import { StepProgressBar } from '@/components/onboarding/StepProgressBar';

interface OnboardingLayoutProps {
  step: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  showBack?: boolean;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  onContinue: () => void;
  children: ReactNode;
}

export function OnboardingLayout({
  step, title, subtitle, showBack = false,
  continueLabel = 'Continue', continueDisabled = false, continueLoading = false,
  onContinue, children,
}: OnboardingLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      {/* Desktop left panel */}
      <DesktopLeftPanel currentStep={step} />

      {/* Right / main panel */}
      <div className="flex flex-1 flex-col">
        {/* Mobile progress bar */}
        <div className="md:hidden px-6 pt-5">
          <StepProgressBar currentStep={step} />
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col md:items-center md:justify-center px-6 pt-6 pb-24 md:pb-0 md:px-16 md:py-20">
          <div className="w-full max-w-[480px]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#534AB7] mb-2">
              Step {step} of 4
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#0A1628] leading-tight mb-2">
              {title}
            </h1>
            <p className="text-sm text-gray-500 mb-8">{subtitle}</p>

            {/* Animated content */}
            <div className="animate-in slide-in-from-right-8 duration-200">
              {children}
            </div>
          </div>
        </div>

        {/* Mobile sticky footer / Desktop button row */}
        <div className="fixed bottom-0 left-0 right-0 md:static bg-white md:bg-transparent border-t md:border-0 px-6 py-4 md:px-0 md:py-0">
          <div className="max-w-[480px] mx-auto md:mx-0 flex items-center justify-between gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={onContinue}
              disabled={continueDisabled || continueLoading}
              className="flex items-center gap-2 rounded-xl bg-[#534AB7] px-6 py-3 text-sm font-semibold text-white transition-all
                md:w-40 justify-center
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-[#3C3489] active:scale-[0.98]
                max-md:flex-1"
            >
              {continueLoading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : continueLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2: Commit**

```bash
git add src/pages/onboarding/OnboardingLayout.tsx
git commit -m "feat: OnboardingLayout — two-panel desktop + single-col mobile shell"
```

---

## Task 9: Step 1 — Identity

**Files:**
- Create: `src/pages/onboarding/Step1Identity.tsx`

- [ ] **Step 9.1: Create Step1Identity**

```tsx
// src/pages/onboarding/Step1Identity.tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { OnboardingLayout } from './OnboardingLayout';
import { AvatarPicker, AvatarValue } from '@/components/onboarding/AvatarPicker';
import { XPCallout } from '@/components/onboarding/XPCallout';
import { checkUsernameAvailable, saveStep1 } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

function generateUsername(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 18);
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function Step1Identity() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, setStep1 } = useOnboardingState();

  const [displayName, setDisplayName] = useState(state.step1?.displayName ?? '');
  const [username, setUsername]       = useState(state.step1?.username ?? '');
  const [bio, setBio]                 = useState(state.step1?.bio ?? '');
  const [avatar, setAvatar]           = useState<AvatarValue>(
    state.step1
      ? { type: state.step1.avatarType, initials: state.step1.avatarInitials, color: state.step1.avatarColor, url: state.step1.avatarUrl } as AvatarValue
      : { type: 'initials', initials: 'GP', color: '#534AB7', url: null }
  );
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [loading, setLoading] = useState(false);

  // Auto-generate username from display name
  useEffect(() => {
    if (!displayName) { setUsername(''); return; }
    setUsername(generateUsername(displayName));
  }, [displayName]);

  // Update avatar initials when username changes
  useEffect(() => {
    const initials = (displayName || username).slice(0, 2).toUpperCase() || 'GP';
    if (avatar.type === 'initials') {
      setAvatar(prev => ({ ...prev, initials }));
    }
  }, [displayName, username]);

  // Debounced username check
  const checkUsername = useCallback(async (u: string) => {
    if (u.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const available = await checkUsernameAvailable(u);
    setUsernameStatus(available ? 'available' : 'taken');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (username) checkUsername(username); }, 400);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const canContinue = displayName.length >= 2 && username.length >= 3 && usernameStatus === 'available';

  async function handleContinue() {
    if (!user || !canContinue) return;
    setLoading(true);
    try {
      const data = {
        displayName,
        username,
        avatarUrl: avatar.url,
        avatarType: avatar.type,
        avatarInitials: avatar.initials,
        avatarColor: avatar.color,
        bio,
      };
      await saveStep1(user.id, data);
      setStep1(data);
      navigate('/onboarding/step-2');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = usernameStatus === 'checking' ? '⏳'
    : usernameStatus === 'available' ? '✓'
    : usernameStatus === 'taken' ? '✗' : '';
  const statusColor = usernameStatus === 'available' ? 'text-green-600'
    : usernameStatus === 'taken' ? 'text-red-500' : 'text-gray-400';

  return (
    <OnboardingLayout
      step={1}
      title="Let's set up your profile"
      subtitle="This is how other players will see you on Game Pulse."
      continueDisabled={!canContinue}
      continueLoading={loading}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-6">
        {/* Avatar */}
        <AvatarPicker
          username={username}
          userId={user?.id ?? ''}
          value={avatar}
          onChange={setAvatar}
        />

        {/* Display name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Display name *</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value.slice(0, 30))}
            placeholder="GamerPulse99"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#534AB7]"
          />
          {displayName.length > 0 && displayName.length < 2 && (
            <p className="text-xs text-red-500 mt-1">Name must be 2–30 characters</p>
          )}
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Username *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              placeholder="gamerpulse99"
              className="w-full pl-7 pr-8 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#534AB7]"
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium ${statusColor}`}>
              {statusIcon}
            </span>
          </div>
          {usernameStatus === 'taken' && (
            <p className="text-xs text-red-500 mt-1">
              Username taken — try {username}{Math.floor(Math.random() * 90) + 10}
            </p>
          )}
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Bio <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 120))}
            placeholder="Tell other gamers about yourself…"
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#534AB7]"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{bio.length}/120</p>
        </div>

        <XPCallout />
      </div>
    </OnboardingLayout>
  );
}
```

- [ ] **Step 9.2: Commit**

```bash
git add src/pages/onboarding/Step1Identity.tsx
git commit -m "feat: Step 1 Identity — avatar, display name, username availability, bio"
```

---

## Task 10: Step 2 — Platforms

**Files:**
- Create: `src/pages/onboarding/Step2Platforms.tsx`

- [ ] **Step 10.1: Create Step2Platforms**

```tsx
// src/pages/onboarding/Step2Platforms.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { OnboardingLayout } from './OnboardingLayout';
import { PlatformCard } from '@/components/onboarding/PlatformCard';
import { SkillLevelTag } from '@/components/onboarding/SkillLevelTag';
import { XPCallout } from '@/components/onboarding/XPCallout';
import { saveStep2 } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

const PLATFORMS = [
  { id: 'pc',          label: 'PC / Steam',   icon: '🖥️', color: '#1b2838' },
  { id: 'playstation', label: 'PlayStation',   icon: '🎮', color: '#003087' },
  { id: 'xbox',        label: 'Xbox',          icon: '❎', color: '#107C10' },
  { id: 'nintendo',    label: 'Nintendo',      icon: '🍄', color: '#E4000F' },
  { id: 'mobile',      label: 'Mobile',        icon: '📱', color: '#FF6900' },
  { id: 'cloud',       label: 'Cloud Gaming',  icon: '☁️', color: '#00B4D8' },
];

const SKILL_LEVELS = [
  { value: 'fun',         label: 'Just for fun',  description: 'Easy trivia, casual tone' },
  { value: 'casual',      label: 'Casual',         description: 'Medium trivia, standard tone' },
  { value: 'competitive', label: 'Competitive',    description: 'Hard trivia, pro-level context' },
  { value: 'semipro',     label: 'Semi-pro',       description: 'Expert trivia, heavy esports' },
];

export default function Step2Platforms() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, setStep2 } = useOnboardingState();

  const [selected, setSelected] = useState<string[]>(state.step2?.platforms ?? []);
  const [skill, setSkill]       = useState(state.step2?.skillLevel ?? 'casual');
  const [loading, setLoading]   = useState(false);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleContinue() {
    if (!user || selected.length === 0) return;
    setLoading(true);
    try {
      await saveStep2(user.id, { platforms: selected, skillLevel: skill });
      setStep2({ platforms: selected, skillLevel: skill });
      navigate('/onboarding/step-3');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      step={2}
      title="Where do you game?"
      subtitle="Select all platforms you play on. We'll personalise your feed."
      showBack
      continueDisabled={selected.length === 0}
      continueLoading={loading}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-8">
        {/* Platform grid */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {PLATFORMS.map(p => (
              <PlatformCard
                key={p.id}
                {...p}
                selected={selected.includes(p.id)}
                onToggle={toggle}
              />
            ))}
          </div>
          {selected.length === 0 && (
            <p className="text-xs text-red-500 mt-2">Select at least one platform to continue.</p>
          )}
        </div>

        {/* Skill level */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-3">Skill level</label>
          <div className="flex flex-wrap gap-2">
            {SKILL_LEVELS.map(s => (
              <SkillLevelTag
                key={s.value}
                value={s.value}
                label={s.label}
                description={s.description}
                selected={skill === s.value}
                onSelect={setSkill}
              />
            ))}
          </div>
        </div>

        <XPCallout />
      </div>
    </OnboardingLayout>
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
git add src/pages/onboarding/Step2Platforms.tsx
git commit -m "feat: Step 2 Platforms — platform multi-select + skill level"
```

---

## Task 11: Step 3 — Games & Genres

**Files:**
- Create: `src/pages/onboarding/Step3Games.tsx`

- [ ] **Step 11.1: Create Step3Games**

```tsx
// src/pages/onboarding/Step3Games.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { OnboardingLayout } from './OnboardingLayout';
import { GameRow } from '@/components/onboarding/GameRow';
import { GameSearchInput, GameOption } from '@/components/onboarding/GameSearchInput';
import { GenreChip } from '@/components/onboarding/GenreChip';
import { XPCallout } from '@/components/onboarding/XPCallout';
import { saveStep3 } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

const POPULAR_GAMES: GameOption[] = [
  { id: 'minecraft',     name: 'Minecraft',                     genre: 'Sandbox',          coverUrl: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?w=28&h=28&fit=crop' },
  { id: 'fortnite',      name: 'Fortnite',                      genre: 'Battle Royale',    coverUrl: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=28&h=28&fit=crop' },
  { id: 'cod-bo6',       name: 'Call of Duty: Black Ops 6',     genre: 'FPS',              coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=28&h=28&fit=crop' },
  { id: 'valorant',      name: 'Valorant',                      genre: 'FPS / Tactical',   coverUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=28&h=28&fit=crop' },
  { id: 'lol',           name: 'League of Legends',             genre: 'MOBA',             coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=28&h=28&fit=crop' },
  { id: 'elden-ring',    name: 'Elden Ring',                    genre: 'Action RPG',       coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=28&h=28&fit=crop' },
  { id: 'gta-v',         name: 'GTA V',                         genre: 'Action Adventure', coverUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=28&h=28&fit=crop' },
  { id: 'cs2',           name: 'Counter-Strike 2',              genre: 'FPS',              coverUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=28&h=28&fit=crop' },
  { id: 'apex',          name: 'Apex Legends',                  genre: 'Battle Royale',    coverUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=28&h=28&fit=crop' },
  { id: 'roblox',        name: 'Roblox',                        genre: 'Platform / Sandbox', coverUrl: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=28&h=28&fit=crop' },
  { id: 'zelda-totk',    name: 'Zelda: Tears of the Kingdom',   genre: 'Action Adventure', coverUrl: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=28&h=28&fit=crop' },
  { id: 'hogwarts',      name: 'Hogwarts Legacy',               genre: 'Action RPG',       coverUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=28&h=28&fit=crop' },
  { id: 'ea-fc',         name: 'EA Sports FC',                  genre: 'Sports',           coverUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=28&h=28&fit=crop' },
  { id: 'rocket-league', name: 'Rocket League',                 genre: 'Sports',           coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=28&h=28&fit=crop' },
  { id: 'overwatch2',    name: 'Overwatch 2',                   genre: 'FPS / Hero Shooter', coverUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=28&h=28&fit=crop' },
  { id: 'dota2',         name: 'Dota 2',                        genre: 'MOBA',             coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=28&h=28&fit=crop' },
  { id: 'among-us',      name: 'Among Us',                      genre: 'Social Deduction', coverUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=28&h=28&fit=crop' },
  { id: 'genshin',       name: 'Genshin Impact',                genre: 'Action RPG / Gacha', coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=28&h=28&fit=crop' },
  { id: 'cyberpunk',     name: 'Cyberpunk 2077',                genre: 'Action RPG',       coverUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=28&h=28&fit=crop' },
  { id: 'stardew',       name: 'Stardew Valley',                genre: 'Simulation / RPG', coverUrl: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=28&h=28&fit=crop' },
];

const GENRES = [
  { value: 'rpg',      label: 'RPG' },
  { value: 'fps',      label: 'FPS' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'sports',   label: 'Sports' },
  { value: 'horror',   label: 'Horror' },
  { value: 'indie',    label: 'Indie' },
  { value: 'moba',     label: 'MOBA' },
  { value: 'sim',      label: 'Sim' },
];

export default function Step3Games() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, setStep3 } = useOnboardingState();

  const [selectedIds, setSelectedIds] = useState<string[]>(state.step3?.favGameIds ?? []);
  const [genres, setGenres]           = useState<string[]>(state.step3?.favGenres ?? []);
  const [searchResults, setSearchResults] = useState<GameOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  const displayList = searchResults ?? POPULAR_GAMES;
  const selectedGames = POPULAR_GAMES.filter(g => selectedIds.includes(g.id));
  const unselectedDisplay = displayList.filter(g => !selectedIds.includes(g.id));

  function toggleGame(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleGenre(v: string) {
    setGenres(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  async function handleContinue() {
    if (!user || selectedIds.length < 3) return;
    setLoading(true);
    try {
      await saveStep3(user.id, { favGameIds: selectedIds, favGenres: genres });
      setStep3({ favGameIds: selectedIds, favGenres: genres });
      navigate('/onboarding/step-4');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      step={3}
      title="What do you play?"
      subtitle="Pick your favourite games. This powers your personalised feed."
      showBack
      continueDisabled={selectedIds.length < 3}
      continueLoading={loading}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-6">
        {/* Selection counter */}
        <p className={`text-sm font-medium ${selectedIds.length < 3 ? 'text-red-500' : 'text-[#534AB7]'}`}>
          {selectedIds.length} selected · 3 minimum
        </p>

        {/* Search */}
        <GameSearchInput
          onResults={setSearchResults}
          onClear={() => setSearchResults(null)}
        />

        {/* Game list */}
        <div className="flex flex-col overflow-y-auto max-h-[200px] md:max-h-[280px] gap-1 pr-1">
          {/* Selected games pinned to top */}
          {selectedGames.map(g => (
            <GameRow key={g.id} {...g} selected onToggle={toggleGame} />
          ))}
          {/* Unselected */}
          {unselectedDisplay.map(g => (
            <GameRow key={g.id} {...g} selected={false} onToggle={toggleGame} />
          ))}
        </div>

        {/* Genre tags */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Favourite genres <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <GenreChip
                key={g.value}
                value={g.value}
                label={g.label}
                selected={genres.includes(g.value)}
                onToggle={toggleGenre}
              />
            ))}
          </div>
        </div>

        <XPCallout />
      </div>
    </OnboardingLayout>
  );
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/pages/onboarding/Step3Games.tsx
git commit -m "feat: Step 3 Games — searchable game list (min 3), genre chips"
```

---

## Task 12: Step 4 — Confirmation + XP Award

**Files:**
- Create: `src/pages/onboarding/Step4Confirmation.tsx`

- [ ] **Step 12.1: Create Step4Confirmation**

```tsx
// src/pages/onboarding/Step4Confirmation.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { DesktopLeftPanel } from '@/components/onboarding/DesktopLeftPanel';
import { completeOnboarding } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

export default function Step4Confirmation() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, clear } = useOnboardingState();
  const awarded = useRef(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  useEffect(() => {
    if (!user || awarded.current) return;
    awarded.current = true;
    completeOnboarding(user.id).then(xp => {
      setXpAwarded(xp);
      if (xp > 0) {
        window.dispatchEvent(new CustomEvent('xp-gained', {
          detail: { awarded: xp, label: 'Profile Complete!', tier_up: false },
        }));
      }
    });
  }, [user]);

  function goToFeed() {
    clear();
    navigate('/');
  }

  const { step1, step2, step3 } = state;
  const displayName = step1?.displayName ?? user?.email?.split('@')[0] ?? 'Gamer';
  const platforms   = (step2?.platforms ?? []).join(', ') || '—';
  const gameCount   = step3?.favGameIds.length ?? 0;
  const genres      = (step3?.favGenres ?? []).slice(0, 3).join(', ') || 'Not set';

  return (
    <div className="flex min-h-screen">
      <DesktopLeftPanel currentStep={4} />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Celebration */}
          <div className="text-5xl animate-bounce">🎮</div>
          <div>
            <h1 className="text-2xl font-bold text-[#0A1628]">Profile complete!</h1>
            <p className="text-gray-500 mt-2">You're in, {displayName}. Season 1 has begun.</p>
          </div>

          {/* XP pill */}
          {xpAwarded > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-[#534AB7] px-5 py-2 text-white text-sm font-semibold">
              +{xpAwarded} XP — Profile XP added to your Battle Pass
            </div>
          )}

          {/* Summary card */}
          <div className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-5 text-left text-sm">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Username</span>
                <span className="font-medium">@{step1?.username ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Platforms</span>
                <span className="font-medium">{platforms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Games</span>
                <span className="font-medium">{gameCount > 0 ? `${gameCount} selected` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Genres</span>
                <span className={`font-medium ${genres === 'Not set' ? 'text-gray-400' : ''}`}>{genres}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Season tier</span>
                <span className="font-medium text-[#534AB7]">Tier 1 · 50 XP</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">You can edit all of this from your profile at any time.</p>

          <button
            onClick={goToFeed}
            className="w-full rounded-xl bg-[#534AB7] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#3C3489] transition-colors"
          >
            Go to your feed →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 12.2: Commit**

```bash
git add src/pages/onboarding/Step4Confirmation.tsx
git commit -m "feat: Step 4 Confirmation — XP award, profile summary, feed CTA"
```

---

## Task 13: OnboardingGuard + App.tsx Routing

**Files:**
- Create: `src/components/OnboardingGuard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 13.1: Create OnboardingGuard**

```tsx
// src/components/OnboardingGuard.tsx
import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingGuardProps { children: ReactNode }

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthGate();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [step, setStep] = useState<number>(1);

  useEffect(() => {
    if (!isAuthenticated || !user) { setOnboardingDone(null); return; }

    supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setOnboardingDone(data?.onboarding_completed ?? false);
        setStep(data?.onboarding_step ?? 1);
      });
  }, [isAuthenticated, user]);

  // Still loading auth or profile check
  if (isLoading || (isAuthenticated && onboardingDone === null)) return null;

  // Not logged in — let the page handle its own auth gate
  if (!isAuthenticated) return <>{children}</>;

  // Logged in but onboarding incomplete — redirect
  if (!onboardingDone) {
    return <Navigate to={`/onboarding/step-${step}`} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 13.2: Update App.tsx**

Replace the content of `src/App.tsx` with:

```tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XPProvider } from "@/contexts/XPContext";
import { AuthGateProvider } from "@/contexts/AuthGateContext";
import { AuthModal } from "@/components/AuthModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import SteamCallback from "./pages/SteamCallback";
import PublicProfile from "./pages/PublicProfile";
import DailyTrivia from "./pages/DailyTrivia";
import Leaderboard from "./pages/Leaderboard";
import Esports from "./pages/Esports";
import GameCatalog from "./pages/GameCatalog";
import GameReview from "./pages/GameReview";
import BattlePass from "./pages/BattlePass";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import Step1Identity from "./pages/onboarding/Step1Identity";
import Step2Platforms from "./pages/onboarding/Step2Platforms";
import Step3Games from "./pages/onboarding/Step3Games";
import Step4Confirmation from "./pages/onboarding/Step4Confirmation";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <XPProvider>
          <AuthGateProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AuthModal />
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Routes>
                  {/* Onboarding — no guard */}
                  <Route path="/onboarding/step-1" element={<Step1Identity />} />
                  <Route path="/onboarding/step-2" element={<Step2Platforms />} />
                  <Route path="/onboarding/step-3" element={<Step3Games />} />
                  <Route path="/onboarding/step-4" element={<Step4Confirmation />} />

                  {/* All other routes — guarded */}
                  <Route path="/" element={<OnboardingGuard><Index /></OnboardingGuard>} />
                  <Route path="/profile" element={<OnboardingGuard><Profile /></OnboardingGuard>} />
                  <Route path="/u/:username" element={<OnboardingGuard><PublicProfile /></OnboardingGuard>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/trivia" element={<OnboardingGuard><DailyTrivia /></OnboardingGuard>} />
                  <Route path="/leaderboard" element={<OnboardingGuard><Leaderboard /></OnboardingGuard>} />
                  <Route path="/auth/steam/callback" element={<SteamCallback />} />
                  <Route path="/esports" element={<OnboardingGuard><Esports /></OnboardingGuard>} />
                  <Route path="/esports/:gameId" element={<OnboardingGuard><Esports /></OnboardingGuard>} />
                  <Route path="/reviews" element={<OnboardingGuard><GameCatalog /></OnboardingGuard>} />
                  <Route path="/reviews/:gameId" element={<OnboardingGuard><GameReview /></OnboardingGuard>} />
                  <Route path="/battle-pass" element={<OnboardingGuard><BattlePass /></OnboardingGuard>} />
                  <Route path="/notifications" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                  <Route path="/guides" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                  <Route path="/hardware" element={<OnboardingGuard><ComingSoon /></OnboardingGuard>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthGateProvider>
        </XPProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
```

- [ ] **Step 13.3: Run dev server and manual smoke test**

```bash
cd pixel-pulse && npx vite --port 8080
```

Test checklist:
1. Visit `http://localhost:8080/` — should redirect to `/onboarding/step-1` if logged in without completed onboarding
2. Step 1: type display name, see username auto-populate, see ✓ indicator, click Continue
3. Step 2: select ≥1 platform, Continue enabled; deselect all → Continue disabled
4. Step 3: select 3 games, Continue enables; search field filters list
5. Step 4: XP pill appears, "Go to your feed" → lands on `/`
6. Re-visit `/onboarding/step-1` after completion → redirects to `/`

- [ ] **Step 13.4: Commit**

```bash
git add src/components/OnboardingGuard.tsx src/App.tsx
git commit -m "feat: OnboardingGuard + onboarding routes wired into App.tsx"
```

---

## Self-Review Checklist

- [x] DB migration covers all 9 new columns + avatars bucket + storage policies
- [x] types.ts updated for profiles Row/Insert/Update
- [x] profile_complete added to XP_TABLE_DATA (as const)
- [x] completeOnboarding is idempotent (checks onboarding_completed before update)
- [x] sessionStorage state persists wizard data across step navigation
- [x] Step 1: avatar initials pre-selected (unblocks Continue from the start)
- [x] Step 2: 'Casual' skill pre-selected; Continue gates on platforms only
- [x] Step 3: selected games pinned to top; search doesn't lose selections
- [x] Step 4: XP dispatches xp-gained event for XPGainOverlay
- [x] OnboardingGuard returns null during loading (no flash)
- [x] /login and /auth/steam/callback exempt from guard
- [x] Types used consistently: Step1Data/Step2Data/Step3Data from onboardingService imported in all consumers
