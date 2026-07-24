-- Qualify the vote upsert conflict target. The function returns a column named
-- article_id, so an unqualified ON CONFLICT column list is ambiguous in PL/pgSQL.
create or replace function public.set_article_vote(p_article_id text, p_vote smallint)
returns table (
  article_id text,
  upvotes bigint,
  downvotes bigint,
  comments bigint,
  shares bigint,
  user_vote smallint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_article_id is null or char_length(trim(p_article_id)) < 3 then
    raise exception 'Invalid article';
  end if;
  if p_vote not in (-1, 0, 1) then
    raise exception 'Invalid vote';
  end if;

  if p_vote = 0 then
    delete from public.article_votes
    where article_votes.article_id = p_article_id
      and article_votes.user_id = auth.uid();
  else
    insert into public.article_votes(article_id, user_id, vote)
    values (p_article_id, auth.uid(), p_vote)
    on conflict on constraint article_votes_pkey do update
      set vote = excluded.vote, updated_at = now();
  end if;

  return query
    select engagement.article_id,
      engagement.upvotes,
      engagement.downvotes,
      engagement.comments,
      engagement.shares,
      engagement.user_vote
    from public.get_article_engagement(array[p_article_id]) engagement;
end;
$$;

revoke all on function public.set_article_vote(text, smallint) from public;
grant execute on function public.set_article_vote(text, smallint) to authenticated;

