create or replace function increment_helpful_votes(review_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.user_game_reviews
  set helpful_votes = helpful_votes + 1
  where id = review_id;
end;
$$;
