-- Daily AI trivia lifecycle.
-- Questions remain in the database permanently for reporting/history, while
-- expires_at controls which generated set is eligible for today's quiz.

ALTER TABLE public.trivia_questions
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'Medium'
    CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Expert')),
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE public.trivia_questions
SET expires_at = COALESCE(generated_at, now()) + INTERVAL '24 hours'
WHERE expires_at IS NULL;

ALTER TABLE public.trivia_questions
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '24 hours'),
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trivia_questions_active
  ON public.trivia_questions (expires_at DESC, generated_at DESC);

COMMENT ON COLUMN public.trivia_questions.expires_at IS
  'Controls active quiz eligibility only. Questions and trivia_attempts remain stored as history.';
