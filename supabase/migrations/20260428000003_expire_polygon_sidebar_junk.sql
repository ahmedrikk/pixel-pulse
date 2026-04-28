-- Expire Polygon articles whose summaries contain related-article headlines or login prompts
UPDATE public.cached_articles
SET expires_at = '2000-01-01'::timestamptz, tags = '{}'
WHERE source = 'Polygon'
   AND (
     summary ~ 'Sign in to your Polygon'
     OR summary ~ 'New Steam creature battler'
     OR summary ~ 'developers seek to unionize'
   );
