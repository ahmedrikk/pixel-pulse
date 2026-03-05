/**
 * Profile management functions
 * Handles user profiles, social linking, game preferences
 */

import { supabase, isDemoMode, DEMO_PROFILE, MOCK_USER } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  about_me: string | null;
  created_at: string;
  updated_at: string;
  xp: number;
  level: number;
  daily_bonus_claimed_at: string | null;
  banner_url: string | null;
  nameplate_url: string | null;
  daily_streak: number;
}

export interface SocialAccount {
  id: string;
  provider: 'steam' | 'epic' | 'discord' | 'twitch' | 'youtube';
  provider_account_id: string;
  username: string | null;
  avatar_url: string | null;
  profile_url: string | null;
}

export interface UserGame {
  id: string;
  game_name: string;
  platform: string | null;
  playtime_hours: number;
  is_favorite: boolean;
  image_url: string | null;
}

export interface UserNewsPreference {
  id: string;
  tag: string;
  weight: number;
}

export interface SteamProfile {
  id: string;
  steam_id: string;
  persona_name: string | null;
  profile_url: string | null;
  avatar_full: string | null;
  country_code: string | null;
  total_games: number;
  recent_playtime_2weeks: number;
}

// ============================================
// PROFILE FUNCTIONS
// ============================================

export async function getProfile(userId: string): Promise<Profile | null> {
  if (isDemoMode()) {
    return DEMO_PROFILE as Profile;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  // If no profile exists (legacy user), create one
  if (!data) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const email = user.email || '';
    const username = email.split('@')[0].toLowerCase();

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        username: username,
        display_name: username,
        daily_streak: 0,
        xp: 0,
        level: 1
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile for existing user:', insertError);
      return null;
    }
    return newProfile as Profile;
  }

  return data as Profile;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile by username:', error);
    return null;
  }

  return data as Profile;
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  if (isDemoMode()) {
    return DEMO_PROFILE as Profile;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}

export async function updateProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<Profile | null> {
  // We use upsert to ensure the row is created if missing
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      ...updates,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return null;
  }
  return data;
}

// ============================================
// SOCIAL ACCOUNT FUNCTIONS
// ============================================

export async function getSocialAccounts(userId: string): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching social accounts:', error);
    return [];
  }
  return data || [];
}

export async function linkSocialAccount(
  userId: string,
  provider: SocialAccount['provider'],
  accountId: string,
  username: string,
  avatarUrl?: string,
  profileUrl?: string
): Promise<SocialAccount | null> {
  const { data, error } = await supabase
    .from('social_accounts')
    .upsert({
      user_id: userId,
      provider,
      provider_account_id: accountId,
      username,
      avatar_url: avatarUrl,
      profile_url: profileUrl,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error linking social account:', error);
    return null;
  }

  // Auto-sync profile info if from Steam
  if (provider === 'steam' && (avatarUrl || username)) {
    const { data: profile } = await supabase.from('profiles').select('avatar_url, display_name, username').eq('id', userId).single();

    let updates: Partial<Profile> = {};
    if (!profile?.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;

    if (username && (!profile?.display_name || profile.display_name === profile.username)) {
      updates.display_name = username;
    }

    if (Object.keys(updates).length > 0) {
      await updateProfile(userId, updates);
    }
  }

  return data;
}

export async function unlinkSocialAccount(
  userId: string,
  provider: SocialAccount['provider']
): Promise<boolean> {
  const { error } = await supabase
    .from('social_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    console.error('Error unlinking social account:', error);
    return false;
  }
  return true;
}

// ============================================
// STEAM INTEGRATION
// ============================================

const STEAM_API_KEY = import.meta.env.VITE_STEAM_API_KEY || '';

export function getSteamLoginUrl(returnUrl: string): string {
  const realm = window.location.origin;
  const redirectUri = `${realm}/auth/steam/callback`;

  return `https://steamcommunity.com/openid/login?` + new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': redirectUri,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  }).toString();
}

export async function fetchSteamProfile(steamId: string): Promise<Partial<SteamProfile> | null> {
  try {
    const response = await fetch(
      `/api/steam/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
    );

    if (!response.ok) throw new Error('Steam API error');

    const data = await response.json();
    const player = data.response.players[0];

    if (!player) return null;

    return {
      steam_id: steamId,
      persona_name: player.personaname,
      profile_url: player.profileurl,
      avatar_full: player.avatarfull,
      country_code: player.loccountrycode,
    };
  } catch (error) {
    console.error('Error fetching Steam profile:', error);
    return null;
  }
}

export async function fetchSteamGames(steamId: string): Promise<any[]> {
  try {
    const response = await fetch(
      `/api/steam/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`
    );

    if (!response.ok) throw new Error('Steam API error');

    const data = await response.json();
    return data.response.games || [];
  } catch (error) {
    console.error('Error fetching Steam games:', error);
    return [];
  }
}

export async function saveSteamProfile(
  userId: string,
  steamProfile: Partial<SteamProfile> & { steam_id: string }
): Promise<SteamProfile | null> {
  const { data, error } = await supabase
    .from('steam_profiles')
    .upsert({
      user_id: userId,
      steam_id: steamProfile.steam_id,
      persona_name: steamProfile.persona_name ?? undefined,
      profile_url: steamProfile.profile_url ?? undefined,
      avatar_full: steamProfile.avatar_full ?? undefined,
      country_code: steamProfile.country_code ?? undefined,
      total_games: steamProfile.total_games,
      recent_playtime_2weeks: steamProfile.recent_playtime_2weeks,
      last_synced: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving Steam profile:', error);
    return null;
  }
  return data;
}

/**
 * Sync Steam games to user_games table.
 * Fetches the user's Steam library and upserts games.
 * Returns the count of games synced.
 */
export async function syncSteamGames(
  userId: string,
  steamId: string
): Promise<{ synced: number; totalPlaytime: number }> {
  try {
    const steamGames = await fetchSteamGames(steamId);
    if (!steamGames.length) return { synced: 0, totalPlaytime: 0 };

    // Sort by playtime and take top 50 most-played games
    const topGames = steamGames
      .sort((a: any, b: any) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
      .slice(0, 50);

    let synced = 0;
    let totalPlaytime = 0;

    for (const game of topGames) {
      const playtimeHours = Math.round((game.playtime_forever || 0) / 60);
      totalPlaytime += playtimeHours;

      const { error } = await supabase
        .from('user_games')
        .upsert({
          user_id: userId,
          game_name: game.name,
          platform: 'steam',
          playtime_hours: playtimeHours,
          is_favorite: false,
          image_url: game.appid ? `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_600x900_2x.jpg` : null
        }, { onConflict: 'user_id,game_name,platform' });

      if (!error) synced++;
    }

    // Update steam_profiles with game count and playtime
    await supabase
      .from('steam_profiles')
      .update({
        total_games: steamGames.length,
        recent_playtime_2weeks: steamGames.reduce((sum: number, g: any) => sum + (g.playtime_2weeks || 0), 0),
        last_synced: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return { synced, totalPlaytime };
  } catch (error) {
    console.error('Error syncing Steam games:', error);
    return { synced: 0, totalPlaytime: 0 };
  }
}

// ============================================
// AVATAR & CUSTOMIZATION UPLOADS
// ============================================

/**
 * Upload a profile picture to Supabase Storage.
 * Falls back to base64 data URL if the 'avatars' bucket doesn't exist.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<string | null> {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type — must be an image');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      console.error('File too large — max 5MB');
      return null;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    // Try uploading to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      // Fallback: convert to data URL and store directly in profile
      console.warn('Storage upload failed, using data URL fallback:', error.message);
      const dataUrl = await fileToDataUrl(file);
      await updateProfile(userId, { avatar_url: dataUrl });
      return dataUrl;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Save URL to profile
    await updateProfile(userId, { avatar_url: publicUrl });
    return publicUrl;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return null;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a profile banner image.
 */
export async function uploadBanner(
  userId: string,
  file: File
): Promise<string | null> {
  return uploadCustomImage(userId, file, 'banner');
}

/**
 * Upload a profile nameplate/border image.
 */
export async function uploadNameplate(
  userId: string,
  file: File
): Promise<string | null> {
  return uploadCustomImage(userId, file, 'nameplate');
}

async function uploadCustomImage(
  userId: string,
  file: File,
  type: 'banner' | 'nameplate'
): Promise<string | null> {
  try {
    if (!file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) return null; // 5MB limit

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${type}.${fileExt}`;

    // Try Supabase Storage first
    const { data, error } = await supabase.storage
      .from('avatars') // reusing the avatars bucket for all profile images
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Storage upload failed:', error.message);
      // We do not fallback to Data URL for banners/nameplates because they are too large
      // and will exceed Supabase Payload limits for row updates.
      throw new Error("Supabase Storage upload failed. Is the 'avatars' bucket created?");
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    await updateProfile(userId, { [`${type}_url`]: publicUrl });
    return publicUrl;
  } catch (error) {
    console.error(`Error uploading ${type}:`, error);
    return null;
  }
}

// ============================================
// GAMIFICATION
// ============================================

const XP_PER_LEVEL = 100;
const DAILY_BONUS_XP = 50;

/**
 * Claim the daily login bonus.
 * Returns the amount of XP gained (0 if already claimed today).
 * 
 * Base XP is 50. Streak bonus adds +10 XP per day (up to +100).
 */
export async function claimDailyBonus(userId: string): Promise<number> {
  try {
    // We use getProfile because it handles the legacy user creation (upsert if missing)
    const profile = await getProfile(userId);

    if (!profile) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastClaimed = new Date(0);
    if (profile.daily_bonus_claimed_at) {
      lastClaimed = new Date(profile.daily_bonus_claimed_at);
      lastClaimed.setHours(0, 0, 0, 0);
    }

    const diffDays = Math.floor((today.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already claimed today
      return 0;
    }

    // Calculate new streak
    let newStreak = 1;
    if (diffDays === 1) {
      // Claimed yesterday, maintain streak
      newStreak = (profile.daily_streak || 0) + 1;
    }

    // Calculate XP: 50 base + 10 per streak day (max 100 bonus)
    const streakBonus = Math.min((newStreak - 1) * 10, 100);
    const xpGained = 50 + streakBonus;

    const newXp = (profile.xp || 0) + xpGained;
    const newLevel = Math.floor(newXp / 100) + 1;

    // We use updateProfile which handles upsert inherently
    await updateProfile(userId, {
      xp: newXp,
      level: newLevel,
      daily_bonus_claimed_at: new Date().toISOString(),
      daily_streak: newStreak
    });

    return xpGained;
  } catch (err) {
    console.error('Error claiming daily bonus:', err);
    return 0;
  }
}

// ============================================
// USER GAMES FUNCTIONS
// ============================================

export async function getUserGames(userId: string): Promise<UserGame[]> {
  const { data, error } = await supabase
    .from('user_games')
    .select('*')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching user games:', error);
    return [];
  }
  return (data || []) as UserGame[];
}

export async function addUserGame(
  userId: string,
  gameName: string,
  platform?: string,
  isFavorite: boolean = false,
  imageUrl?: string
): Promise<UserGame | null> {
  const { data, error } = await supabase
    .from('user_games')
    .upsert({
      user_id: userId,
      game_name: gameName,
      platform,
      is_favorite: isFavorite,
      image_url: imageUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding user game:', error);
    return null;
  }
  return data as UserGame;
}

export async function removeUserGame(userId: string, gameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_games')
    .delete()
    .eq('id', gameId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing user game:', error);
    return false;
  }
  return true;
}

export async function toggleFavoriteGame(userId: string, gameId: string, isFavorite: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('user_games')
    .update({ is_favorite: isFavorite })
    .eq('id', gameId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error toggling favorite:', error);
    return false;
  }
  return true;
}

// ============================================
// NEWS PREFERENCES FUNCTIONS
// ============================================

export async function getNewsPreferences(userId: string): Promise<UserNewsPreference[]> {
  const { data, error } = await supabase
    .from('user_news_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('weight', { ascending: false });

  if (error) {
    console.error('Error fetching news preferences:', error);
    return [];
  }
  return data || [];
}

export async function addNewsPreference(userId: string, tag: string): Promise<UserNewsPreference | null> {
  const { data, error } = await supabase
    .from('user_news_preferences')
    .upsert({
      user_id: userId,
      tag: tag.toLowerCase(),
      weight: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding news preference:', error);
    return null;
  }
  return data;
}

export async function removeNewsPreference(userId: string, preferenceId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_news_preferences')
    .delete()
    .eq('id', preferenceId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing news preference:', error);
    return false;
  }
  return true;
}

export async function updatePreferenceWeight(
  userId: string,
  preferenceId: string,
  weight: number
): Promise<boolean> {
  const { error } = await supabase
    .from('user_news_preferences')
    .update({ weight })
    .eq('id', preferenceId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating preference weight:', error);
    return false;
  }
  return true;
}
