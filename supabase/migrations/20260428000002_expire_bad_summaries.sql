UPDATE public.cached_articles
SET expires_at = '2000-01-01'::timestamptz,
    tags = '{}'
WHERE summary ~ 'Logan Paul|Michael Jackson wanted to play|7 movie roles'
   OR summary ~ '^us The '
   OR (LENGTH(summary) > 0 AND RIGHT(summary, 1) NOT IN ('.', '!', '?', '"'));
