-- QA F15.2 follow-up (2026-07-07): predictions has RLS enabled but only a
-- SELECT policy existed — every authenticated INSERT was silently rejected,
-- so no prediction ever saved. Duplicates were never the real issue (the
-- predictions_user_id_match_id_key unique constraint already guards those);
-- inserts themselves were impossible.

do $$ begin
  create policy "users insert own predictions"
    on public.predictions for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
