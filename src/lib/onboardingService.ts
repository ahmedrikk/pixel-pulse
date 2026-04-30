import { supabase } from '@/integrations/supabase/client';

export const BANNER_GRADIENTS: Record<string, string> = {
  bn1: 'linear-gradient(135deg,#0A1628,#FB923C)',
  bn2: 'linear-gradient(135deg,#0d1b2e,#534AB7)',
  bn3: 'linear-gradient(135deg,#001a0a,#0D9488)',
  bn4: 'linear-gradient(135deg,#1a0000,#DC2626)',
  bn5: 'linear-gradient(135deg,#1a0a1a,#7C3AED)',
  bn6: 'linear-gradient(135deg,#0d1b2e,#D97706)',
};

export interface Step1Data {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  avatarType: 'upload' | 'preset' | 'initials';
  avatarInitials: string;
  avatarColor: string;
  bio: string;
  bannerPreset: string;
}

export interface Step2Data {
  platforms: string[];
  skillLevel: string;
}

export interface Step3Data {
  favGameIds: string[];
  favGenres: string[];
}

/** Returns true if username is available */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  // PGRST116 = no rows found = username is available
  if (error?.code === 'PGRST116') return true;
  if (error) return false; // network error — treat conservatively as unavailable
  return !data;
}

/** Save Step 1 data to profiles, advance onboarding_step to 2 */
export async function saveStep1(userId: string, data: Step1Data): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: data.displayName,
      username: data.username,
      avatar_url: data.avatarUrl,
      avatar_type: data.avatarType,
      avatar_initials: data.avatarInitials,
      avatar_color: data.avatarColor,
      about_me: data.bio,
      banner_url: BANNER_GRADIENTS[data.bannerPreset] ?? null,
      onboarding_step: 2,
    })
    .eq('id', userId);

  if (error) throw new Error(`saveStep1 failed: ${error.message}`);
}

/** Save Step 2 data to profiles, advance onboarding_step to 3 */
export async function saveStep2(userId: string, data: Step2Data): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      platforms: data.platforms,
      skill_level: data.skillLevel,
      onboarding_step: 3,
    })
    .eq('id', userId);

  if (error) throw new Error(`saveStep2 failed: ${error.message}`);
}

/** Save Step 3 data to profiles, advance onboarding_step to 4 */
export async function saveStep3(userId: string, data: Step3Data): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      fav_game_ids: data.favGameIds,
      fav_genres: data.favGenres,
      onboarding_step: 4,
    })
    .eq('id', userId);

  if (error) throw new Error(`saveStep3 failed: ${error.message}`);
}

/**
 * Mark onboarding complete and award +50 XP (idempotent).
 * Returns awarded XP (0 if already completed).
 */
export async function completeOnboarding(userId: string): Promise<number> {
  // Check if already completed
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, xp, xp_season')
    .eq('id', userId)
    .single();

  if (!profile || profile.onboarding_completed) return 0;

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: 4,
      xp: (profile.xp ?? 0) + 50,
      xp_season: (profile.xp_season ?? 0) + 50,
    })
    .eq('id', userId);

  if (error) throw new Error(`completeOnboarding failed: ${error.message}`);
  return 50;
}

/** Upload avatar file to Supabase Storage, return public URL */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(`Avatar upload failed: ${error.message}`);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
