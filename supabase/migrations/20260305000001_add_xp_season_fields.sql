-- Extend public.profiles for Battle Pass XP system (Season 1)
-- Note: existing `xp` column (from 20260226000002) serves as xp_lifetime — not renamed, still incremented by the edge function.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_today           INTEGER NOT NULL DEFAULT 0
                                                -- DB ceiling (500) is intentionally higher than the software DAILY_CAP (400).
                                                -- Bypass actions (streak_7/streak_30) do NOT add to xp_today, so the
                                                -- effective max from the edge function is 400. The extra headroom guards
                                                -- against future changes or admin overrides without requiring a schema migration.
                                                CONSTRAINT xp_today_cap CHECK (xp_today >= 0 AND xp_today <= 500),
  ADD COLUMN IF NOT EXISTS xp_today_reset_date DATE,
  ADD COLUMN IF NOT EXISTS xp_season          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier               INTEGER NOT NULL DEFAULT 0
                                                CONSTRAINT tier_range CHECK (tier >= 0 AND tier <= 25),
  ADD COLUMN IF NOT EXISTS streak_frozen      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS freeze_window_start DATE,
  ADD COLUMN IF NOT EXISTS last_active_day    DATE;

-- NOTE: The seasons INSERT seed is intentionally omitted here.
--       It will be applied in Task 2's migration once the seasons table exists.
