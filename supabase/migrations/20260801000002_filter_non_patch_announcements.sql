-- Remove commerce, community, and roadmap posts that use the word "update"
-- but are not game patches. Strong patch/hotfix/release-note titles remain.
delete from public.game_patches
where patch_type = 'update'
  and title ~* '(store|shop|marketplace|sale|bundle|cosmetic|appearance|esports|tournament|community|developer|devstream|workshop|roadmap|release[[:space:]]+schedule|specifications)'
  and title !~* '\m(patch|hotfix|changelog|maintenance|balance)\M'
  and title !~* 'release[[:space:]]+notes?';

-- Steam embeds clan-image placeholders in announcement bodies. They are useful
-- to Steam's renderer but read as visual noise in a plain-text Talus card.
update public.game_patches
set
  content_text = trim(regexp_replace(content_text, '\{STEAM_CLAN_IMAGE\}/[^[:space:]]+', ' ', 'gi')),
  summary = trim(regexp_replace(summary, '\{STEAM_CLAN_IMAGE\}/[^[:space:]]+', ' ', 'gi')),
  updated_at = now()
where content_text ~ '\{STEAM_CLAN_IMAGE\}'
   or summary ~ '\{STEAM_CLAN_IMAGE\}';
