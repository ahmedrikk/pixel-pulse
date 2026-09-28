-- Administrator-selected artwork is a distinct, trusted image source.
alter table public.games drop constraint if exists games_image_source_check;
alter table public.games add constraint games_image_source_check
  check (image_source is null or image_source in ('igdb', 'rawg', 'steam', 'placeholder', 'upload', 'manual', 'admin'));
