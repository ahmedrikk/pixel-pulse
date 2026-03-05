-- In addition to NULL, delete empty string image URLs if they still exist
DELETE FROM public.user_games WHERE image_url = '' AND platform = 'steam';
