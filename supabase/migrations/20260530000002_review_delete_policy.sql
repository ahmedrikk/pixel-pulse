-- Let users delete their own game reviews (for the profile "My Reviews" manager).
create policy "users can delete own reviews"
  on public.user_game_reviews for delete
  using (auth.uid() = user_id);
