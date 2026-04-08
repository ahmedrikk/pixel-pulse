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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users upload own avatar' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users upload own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read avatars' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Public read avatars"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');
  END IF;
END $$;
