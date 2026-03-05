-- Delete games that were synced previously without images to clean up duplicates
DELETE FROM public.user_games WHERE image_url IS NULL AND platform = 'steam';
