-- supabase/migrations/20260305000002_create_xp_tables.sql

-- Seasons
CREATE TABLE IF NOT EXISTS public.seasons (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed Season 1 (deferred from Task 1 migration)
INSERT INTO public.seasons (id, name, start_date, end_date, is_active)
VALUES (1, 'Season 1', '2026-03-05', '2026-06-03', TRUE)
ON CONFLICT DO NOTHING;

-- XP audit log + dedup
CREATE TABLE IF NOT EXISTS public.xp_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action_type        TEXT NOT NULL,
  ref_id             TEXT NOT NULL DEFAULT '',
  xp_awarded         INTEGER NOT NULL,
  multiplier_applied NUMERIC(4,2) DEFAULT 1.0,
  event_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_dedup
  ON public.xp_events (user_id, action_type, ref_id, event_date);

-- Trivia question pool
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  options       JSONB NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  topic         TEXT,
  generated_at  TIMESTAMPTZ DEFAULT now()
);

-- Per-user trivia appearance tracking (14-day rotation)
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
  score          INTEGER CHECK (score >= 0),
  xp_awarded     INTEGER NOT NULL DEFAULT 0,
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
  xp_participation INTEGER NOT NULL DEFAULT 0,
  xp_bonus         INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  UNIQUE (user_id, match_id)
);

-- Article read dedup (per user, per article, per action, per day)
CREATE TABLE IF NOT EXISTS public.article_reads (
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_url  TEXT NOT NULL,
  action_type  TEXT NOT NULL,
  read_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, article_url, action_type, read_date)
);

-- Article reactions + comments (1 of each per user per article)
CREATE TABLE IF NOT EXISTS public.article_interactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  article_url      TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('react','comment')),
  content          TEXT,
  upvote_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, article_url, interaction_type)
);

-- Tier rewards per season
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id    INTEGER NOT NULL REFERENCES public.seasons(id),
  tier         INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 25),
  reward_type  TEXT NOT NULL,
  reward_value TEXT,
  claimed_at   TIMESTAMPTZ DEFAULT now(),
  redeemed_at  TIMESTAMPTZ
);

-- User titles (active + unlocked list)
CREATE TABLE IF NOT EXISTS public.user_titles (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  active_title    TEXT,
  unlocked_titles TEXT[] NOT NULL DEFAULT '{}'
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read seasons" ON public.seasons FOR SELECT USING (TRUE);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own xp_events" ON public.xp_events FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read trivia questions" ON public.trivia_questions FOR SELECT USING (TRUE);

ALTER TABLE public.trivia_user_seen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own trivia seen" ON public.trivia_user_seen;
CREATE POLICY "Users select own trivia seen" ON public.trivia_user_seen FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.trivia_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own trivia attempts" ON public.trivia_attempts;
CREATE POLICY "Users select own trivia attempts" ON public.trivia_attempts FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own predictions" ON public.predictions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.article_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own article reads" ON public.article_reads;
CREATE POLICY "Users select own article reads" ON public.article_reads FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.article_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own interactions" ON public.article_interactions;
CREATE POLICY "Users manage own interactions" ON public.article_interactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can read interactions" ON public.article_interactions FOR SELECT USING (TRUE);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own rewards" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own titles" ON public.user_titles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read titles" ON public.user_titles FOR SELECT USING (TRUE);

-- ============================================
-- Additional Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_xp_events_user_date ON public.xp_events (user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_trivia_user_seen_user ON public.trivia_user_seen (user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON public.predictions (match_id);
