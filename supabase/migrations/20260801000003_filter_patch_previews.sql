-- Preview and registration announcements can mention a patch without containing
-- the released notes. Keep the permanent archive limited to shipped updates.
delete from public.game_patches
where title ~* '(stress[[:space:]]+test|register[[:space:]]+now|hotfix[[:space:]]+incoming|patch[[:space:]]+incoming)';
