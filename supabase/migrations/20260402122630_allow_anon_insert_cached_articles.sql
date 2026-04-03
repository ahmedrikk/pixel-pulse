-- Allow service inserts from anon role (used by local scraper pipeline)
CREATE POLICY "allow_anon_insert" ON public.cached_articles
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "allow_anon_update" ON public.cached_articles
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
