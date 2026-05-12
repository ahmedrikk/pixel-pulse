-- Add claimed flag to user_rewards so users can manually claim tier rewards
ALTER TABLE public.user_rewards
  ADD COLUMN IF NOT EXISTS claimed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_rewards_claimed
  ON public.user_rewards (user_id, claimed);
