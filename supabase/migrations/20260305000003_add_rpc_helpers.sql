-- RPC helper: append a title to user_titles.unlocked_titles (idempotent)
CREATE OR REPLACE FUNCTION public.append_unlocked_title(uid UUID, title TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_titles (user_id, unlocked_titles)
  VALUES (uid, ARRAY[title])
  ON CONFLICT (user_id) DO UPDATE
    SET unlocked_titles = array_append(
      COALESCE(user_titles.unlocked_titles, '{}'),
      title
    )
  WHERE NOT (title = ANY(COALESCE(user_titles.unlocked_titles, '{}')));
END;
$$;

-- RPC helper: atomically increment XP fields (used for refunds with negative delta)
CREATE OR REPLACE FUNCTION public.increment_xp(
  uid          UUID,
  delta_today  INTEGER,
  delta_season INTEGER,
  delta_lifetime INTEGER
)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.profiles
  SET xp_today  = GREATEST(0, xp_today  + delta_today),
      xp_season = GREATEST(0, xp_season + delta_season),
      xp        = GREATEST(0, xp        + delta_lifetime)
  WHERE id = uid;
$$;
