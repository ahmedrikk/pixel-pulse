-- Talus HUB engagement widgets: Higher or Lower, community sentiment, and
-- curated daily gaming-history facts. Public reads are safe; all persistent
-- user actions are performed through authenticated, atomic RPC functions.

CREATE TABLE IF NOT EXISTS public.hub_higher_lower_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'metacritic_score', 'steam_player_count', 'esports_prize_pool',
    'release_year', 'twitch_hours_watched', 'metacritic_user_score'
  )),
  category_label TEXT NOT NULL,
  name TEXT NOT NULL,
  cover_emoji TEXT NOT NULL DEFAULT '🎮',
  cover_color TEXT NOT NULL DEFAULT '#EEEDFE',
  value NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.hub_higher_lower_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  best_run INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_higher_lower_runs (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  round_id UUID NOT NULL DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  locked_item_id TEXT NOT NULL REFERENCES public.hub_higher_lower_items(id),
  hidden_item_id TEXT NOT NULL REFERENCES public.hub_higher_lower_items(id),
  run_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_higher_lower_guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  round_id UUID NOT NULL,
  guess TEXT NOT NULL CHECK (guess IN ('higher', 'lower')),
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, round_id)
);

CREATE TABLE IF NOT EXISTS public.hub_sentiment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  game_tag TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.hub_sentiment_votes (
  question_id UUID NOT NULL REFERENCES public.hub_sentiment_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.hub_history_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL CHECK (date ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  year INTEGER NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  game_tag TEXT,
  image_url TEXT,
  source_url TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (date, year, headline)
);

ALTER TABLE public.hub_higher_lower_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_higher_lower_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_higher_lower_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_higher_lower_guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_sentiment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_sentiment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_history_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads Higher or Lower items" ON public.hub_higher_lower_items
  FOR SELECT USING (active);
CREATE POLICY "Users read own Higher or Lower score" ON public.hub_higher_lower_scores
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own Higher or Lower run" ON public.hub_higher_lower_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own Higher or Lower guesses" ON public.hub_higher_lower_guesses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public reads active sentiment questions" ON public.hub_sentiment_questions
  FOR SELECT USING (is_active AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Users read own sentiment votes" ON public.hub_sentiment_votes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public reads published history" ON public.hub_history_facts
  FOR SELECT USING (published);

CREATE INDEX IF NOT EXISTS idx_hub_hl_items_category ON public.hub_higher_lower_items(category) WHERE active;
CREATE INDEX IF NOT EXISTS idx_hub_hl_guesses_today ON public.hub_higher_lower_guesses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_sentiment_active ON public.hub_sentiment_questions(created_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_hub_history_date ON public.hub_history_facts(date, year DESC) WHERE published;

INSERT INTO public.hub_higher_lower_items (id, category, category_label, name, cover_emoji, cover_color, value) VALUES
  ('meta-elden-ring', 'metacritic_score', 'Metacritic Score', 'Elden Ring', '🐉', '#F3E8FF', 96),
  ('meta-hollow-knight', 'metacritic_score', 'Metacritic Score', 'Hollow Knight', '🌿', '#DCFCE7', 90),
  ('meta-baldurs-gate-3', 'metacritic_score', 'Metacritic Score', 'Baldur''s Gate 3', '🎲', '#FEF3C7', 96),
  ('meta-hades', 'metacritic_score', 'Metacritic Score', 'Hades', '🔥', '#FEE2E2', 93),
  ('year-minecraft', 'release_year', 'Release Year', 'Minecraft', '⛏️', '#DCFCE7', 2011),
  ('year-fortnite', 'release_year', 'Release Year', 'Fortnite', '🚌', '#DBEAFE', 2017),
  ('year-halo', 'release_year', 'Release Year', 'Halo: Combat Evolved', '🪖', '#E0E7FF', 2001),
  ('year-portal', 'release_year', 'Release Year', 'Portal', '🌀', '#FFEDD5', 2007),
  ('steam-cs2', 'steam_player_count', 'Steam Peak Players', 'Counter-Strike 2', '🎯', '#FEE2E2', 1860000),
  ('steam-pubg', 'steam_player_count', 'Steam Peak Players', 'PUBG', '🍳', '#FEF3C7', 3257248),
  ('steam-palworld', 'steam_player_count', 'Steam Peak Players', 'Palworld', '🐾', '#DBEAFE', 2101867),
  ('steam-cyberpunk', 'steam_player_count', 'Steam Peak Players', 'Cyberpunk 2077', '🌃', '#FCE7F3', 1054388),
  ('prize-dota2', 'esports_prize_pool', 'Largest Prize Pool', 'Dota 2', '🛡️', '#FEE2E2', 40018195),
  ('prize-fortnite', 'esports_prize_pool', 'Largest Prize Pool', 'Fortnite', '🏆', '#DBEAFE', 30000000),
  ('prize-lol', 'esports_prize_pool', 'Largest Prize Pool', 'League of Legends', '⚔️', '#E0E7FF', 6450000),
  ('prize-cs', 'esports_prize_pool', 'Largest Prize Pool', 'Counter-Strike', '💣', '#FEF3C7', 3000000),
  ('twitch-lol', 'twitch_hours_watched', 'Twitch Hours Watched', 'League of Legends', '⚔️', '#E0E7FF', 1350000000),
  ('twitch-gta5', 'twitch_hours_watched', 'Twitch Hours Watched', 'Grand Theft Auto V', '🌴', '#DCFCE7', 1300000000),
  ('twitch-valorant', 'twitch_hours_watched', 'Twitch Hours Watched', 'VALORANT', '🔺', '#FEE2E2', 850000000),
  ('twitch-minecraft', 'twitch_hours_watched', 'Twitch Hours Watched', 'Minecraft', '⛏️', '#DCFCE7', 620000000),
  ('user-witcher3', 'metacritic_user_score', 'Metacritic User Score', 'The Witcher 3', '🐺', '#E5E7EB', 9.1),
  ('user-celeste', 'metacritic_user_score', 'Metacritic User Score', 'Celeste', '🏔️', '#DBEAFE', 8.7),
  ('user-rdr2', 'metacritic_user_score', 'Metacritic User Score', 'Red Dead Redemption 2', '🤠', '#FEE2E2', 8.8),
  ('user-disco', 'metacritic_user_score', 'Metacritic User Score', 'Disco Elysium', '🕵️', '#FEF3C7', 8.3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hub_sentiment_questions (question, game_tag) VALUES
  ('Is GTA 6 going to be worth the wait?', 'GTA 6'),
  ('Should publishers stop charging $80 for standard editions?', 'Game Prices'),
  ('Is cross-platform multiplayer now essential?', 'Crossplay'),
  ('Should every competitive game include a solo queue?', 'Esports'),
  ('Are remakes taking too much attention away from new games?', 'Remakes')
ON CONFLICT DO NOTHING;

INSERT INTO public.hub_history_facts (date, year, headline, description, game_tag, source_url) VALUES
  ('07-17', 1987, 'After Burner took flight in arcades', 'Sega''s high-speed combat flight game first reached arcades, becoming one of the defining spectacle-driven games of its era.', 'After Burner', 'https://www.gematsu.com/2017/01/major-games-industry-anniversaries-2017'),
  ('07-17', 1992, 'Summer Carnival ''92: Recca launched', 'The famously intense Famicom shooter arrived in Japan and later became a cult favorite for pushing Nintendo''s hardware to its limits.', 'Recca', 'https://www.mobygames.com/this-day-in-gaming/7/17/'),
  ('07-17', 1998, 'Banjo-Kazooie reached more players', 'Rare''s colorful Nintendo 64 platformer continued its international rollout and cemented its place among the console''s signature adventures.', 'Banjo-Kazooie', 'https://www.mobygames.com/this-day-in-gaming/7/17/'),
  ('07-17', 2020, 'Ghost of Tsushima launched', 'Sucker Punch invited players into its open-world samurai epic on PlayStation 4, introducing Jin Sakai and the island of Tsushima.', 'Ghost of Tsushima', 'https://www.mobygames.com/this-day-in-gaming/7/17/'),
  ('07-17', 2020, 'Paper Mario folded into a new adventure', 'Paper Mario: The Origami King launched for Nintendo Switch with a paper-crafted world and ring-based battle puzzles.', 'Paper Mario', 'https://www.mobygames.com/this-day-in-gaming/7/17/')
ON CONFLICT (date, year, headline) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hub_higher_lower_current()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid(); run_row public.hub_higher_lower_runs%ROWTYPE;
  cat TEXT; item_a public.hub_higher_lower_items%ROWTYPE; item_b public.hub_higher_lower_items%ROWTYPE;
  best INTEGER := 0; guesses_today INTEGER := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO run_row FROM public.hub_higher_lower_runs WHERE user_id = uid;
  IF NOT FOUND THEN
    SELECT category INTO cat FROM public.hub_higher_lower_items WHERE active GROUP BY category ORDER BY random() LIMIT 1;
    SELECT * INTO item_a FROM public.hub_higher_lower_items WHERE active AND category = cat ORDER BY random() LIMIT 1;
    SELECT * INTO item_b FROM public.hub_higher_lower_items WHERE active AND category = cat AND id <> item_a.id ORDER BY random() LIMIT 1;
    INSERT INTO public.hub_higher_lower_runs(user_id, category, locked_item_id, hidden_item_id)
      VALUES(uid, cat, item_a.id, item_b.id) RETURNING * INTO run_row;
  ELSE
    SELECT * INTO item_a FROM public.hub_higher_lower_items WHERE id = run_row.locked_item_id;
    SELECT * INTO item_b FROM public.hub_higher_lower_items WHERE id = run_row.hidden_item_id;
  END IF;
  SELECT best_run INTO best FROM public.hub_higher_lower_scores WHERE user_id = uid;
  SELECT count(*) INTO guesses_today FROM public.hub_higher_lower_guesses WHERE created_at >= date_trunc('day', now());
  RETURN jsonb_build_object('id', run_row.round_id, 'category', run_row.category, 'categoryLabel', item_a.category_label,
    'itemA', jsonb_build_object('name',item_a.name,'coverEmoji',item_a.cover_emoji,'coverColor',item_a.cover_color,'value',item_a.value,'revealed',true),
    'itemB', jsonb_build_object('name',item_b.name,'coverEmoji',item_b.cover_emoji,'coverColor',item_b.cover_color,'value',NULL,'revealed',false),
    'runCount',run_row.run_count,'bestRun',COALESCE(best,0),'totalGuesses',guesses_today);
END $$;

CREATE OR REPLACE FUNCTION public.hub_higher_lower_guess(p_round_id UUID, p_guess TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid(); run_row public.hub_higher_lower_runs%ROWTYPE;
  item_a public.hub_higher_lower_items%ROWTYPE; item_b public.hub_higher_lower_items%ROWTYPE; item_c public.hub_higher_lower_items%ROWTYPE;
  is_correct BOOLEAN; next_count INTEGER; best INTEGER := 0; next_round UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_guess NOT IN ('higher','lower') THEN RAISE EXCEPTION 'Invalid guess'; END IF;
  SELECT * INTO run_row FROM public.hub_higher_lower_runs WHERE user_id=uid AND round_id=p_round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round is no longer active'; END IF;
  SELECT * INTO item_a FROM public.hub_higher_lower_items WHERE id=run_row.locked_item_id;
  SELECT * INTO item_b FROM public.hub_higher_lower_items WHERE id=run_row.hidden_item_id;
  is_correct := CASE WHEN p_guess='higher' THEN item_b.value >= item_a.value ELSE item_b.value <= item_a.value END;
  next_count := CASE WHEN is_correct THEN run_row.run_count + 1 ELSE 0 END;
  INSERT INTO public.hub_higher_lower_guesses(user_id,round_id,guess,correct) VALUES(uid,p_round_id,p_guess,is_correct);
  INSERT INTO public.hub_higher_lower_scores(user_id,best_run) VALUES(uid,CASE WHEN is_correct THEN next_count ELSE run_row.run_count END)
    ON CONFLICT(user_id) DO UPDATE SET best_run=GREATEST(hub_higher_lower_scores.best_run,EXCLUDED.best_run),updated_at=now()
    RETURNING best_run INTO best;
  IF is_correct THEN
    SELECT * INTO item_c FROM public.hub_higher_lower_items WHERE active AND category=run_row.category AND id NOT IN(item_a.id,item_b.id) ORDER BY random() LIMIT 1;
    next_round := gen_random_uuid();
    UPDATE public.hub_higher_lower_runs SET round_id=next_round,locked_item_id=item_b.id,hidden_item_id=item_c.id,run_count=next_count,updated_at=now() WHERE user_id=uid;
  ELSE
    DELETE FROM public.hub_higher_lower_runs WHERE user_id=uid;
  END IF;
  RETURN jsonb_build_object('correct',is_correct,'actualValue',item_b.value,'newRoundId',next_round,'runCount',next_count,'bestRun',best);
END $$;

CREATE OR REPLACE FUNCTION public.hub_higher_lower_leaderboard()
RETURNS TABLE(user_id UUID, username TEXT, best_run INTEGER) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT s.user_id, COALESCE(p.username,'Player'), s.best_run FROM public.hub_higher_lower_scores s
  JOIN public.profiles p ON p.id=s.user_id ORDER BY s.best_run DESC, s.updated_at ASC LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.hub_get_sentiment(p_limit INTEGER DEFAULT 5)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total_votes DESC, created_at DESC),'[]'::jsonb)
  FROM (
    SELECT q.created_at, (count(v.*))::int AS total_votes,
      jsonb_build_object('id',q.id,'question',q.question,'gameTag',q.game_tag,
        'yesCount',(count(v.*) FILTER(WHERE v.vote='yes'))::int,
        'noCount',(count(v.*) FILTER(WHERE v.vote='no'))::int,
        'yesPercent',CASE WHEN count(v.*)=0 THEN 0 ELSE round(100.0*count(v.*) FILTER(WHERE v.vote='yes')/count(v.*)) END,
        'noPercent',CASE WHEN count(v.*)=0 THEN 0 ELSE round(100.0*count(v.*) FILTER(WHERE v.vote='no')/count(v.*)) END,
        'userVote',max(v.vote) FILTER(WHERE v.user_id=auth.uid()),'isActive',q.is_active,
        'createdAt',q.created_at,'expiresAt',q.expires_at) AS row_data
    FROM public.hub_sentiment_questions q LEFT JOIN public.hub_sentiment_votes v ON v.question_id=q.id
    WHERE q.is_active AND (q.expires_at IS NULL OR q.expires_at>now()) GROUP BY q.id ORDER BY total_votes DESC,q.created_at DESC LIMIT LEAST(p_limit,5)
  ) ranked
$$;

CREATE OR REPLACE FUNCTION public.hub_vote_sentiment(p_question_id UUID, p_vote TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid UUID:=auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_vote NOT IN('yes','no') THEN RAISE EXCEPTION 'Invalid vote'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.hub_sentiment_questions WHERE id=p_question_id AND is_active AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'Question inactive'; END IF;
  INSERT INTO public.hub_sentiment_votes(question_id,user_id,vote) VALUES(p_question_id,uid,p_vote)
    ON CONFLICT(question_id,user_id) DO UPDATE SET vote=EXCLUDED.vote,updated_at=now();
  RETURN (SELECT value FROM jsonb_array_elements(public.hub_get_sentiment(5)) AS entries(value) WHERE value->>'id'=p_question_id::text LIMIT 1);
END $$;

GRANT EXECUTE ON FUNCTION public.hub_higher_lower_current() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hub_higher_lower_guess(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hub_higher_lower_leaderboard() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_get_sentiment(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_vote_sentiment(UUID,TEXT) TO authenticated;
