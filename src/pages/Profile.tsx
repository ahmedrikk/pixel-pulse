import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Gamepad2,
  Newspaper,
  Link as LinkIcon,
  Save,
  Edit2,
  Monitor,
  MessageCircle,
  Trash2,
  Plus,
  Star,
  X,
  Loader2,
  CheckCircle2,
  Trophy,
  Clock,
  Zap,
  Shield,
  ChevronRight,
  Settings,
  ArrowLeft,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Steam Icon Component
const SteamIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.979 0C5.366 0 0 5.367 0 11.979c0 2.78.94 5.34 2.533 7.364l.834-1.308c-1.324-1.726-2.108-3.88-2.108-6.225 0-5.55 4.534-10.053 10.117-10.053 5.583 0 10.117 4.503 10.117 10.053 0 5.55-4.534 10.053-10.117 10.053-1.273 0-2.495-.242-3.62-.676l-1.388.973C8.762 23.696 10.316 24 11.98 24 18.592 24 24 18.632 24 12.02 24 5.408 18.592 0 11.98 0zm5.368 5.288a3.445 3.445 0 0 0-3.428 3.467 3.445 3.445 0 0 0 3.428 3.467 3.445 3.445 0 0 0 3.428-3.467 3.445 3.445 0 0 0-3.428-3.467zm0 1.403a2.064 2.064 0 0 1 2.025 2.064 2.064 2.064 0 0 1-2.025 2.064 2.064 2.064 0 0 1-2.025-2.064 2.064 2.064 0 0 1 2.025-2.064zM7.143 12.56l-3.96 5.65a7.63 7.63 0 0 0 2.644 1.982l4.358-4.443a3.48 3.48 0 0 1-.334-1.488c0-.81.28-1.556.747-2.147l-.465-1.51-2.99 1.957z" />
  </svg>
);
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/components/ui/use-toast";
import { BattlePassPanel } from "@/components/BattlePassPanel";
import { XP_PER_TIER } from "@/lib/xpConstants";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentUserProfile,
  updateProfile,
  getSocialAccounts,
  getUserGames,
  getNewsPreferences,
  addUserGame,
  removeUserGame,
  toggleFavoriteGame,
  addNewsPreference,
  removeNewsPreference,
  linkSocialAccount,
  unlinkSocialAccount,
  getSteamLoginUrl,
  uploadAvatar,
  syncSteamGames,
  saveSteamProfile,
  fetchSteamProfile,
  claimDailyBonus,
  uploadBanner,
  uploadNameplate,
  type Profile as ProfileType,
  type SocialAccount,
  type UserGame,
  type UserNewsPreference
} from "@/lib/profile";
import { CATEGORIES } from "@/data/mockNews";

const POPULAR_GAMES = [
  "Counter-Strike 2", "Valorant", "League of Legends", "Dota 2",
  "Apex Legends", "Fortnite", "Minecraft", "GTA V",
  "Elden Ring", "Baldur's Gate 3", "Call of Duty", "Overwatch 2",
  "Rocket League", "Rainbow Six Siege", "Genshin Impact", "Roblox"
];

export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [games, setGames] = useState<UserGame[]>([]);
  const [preferences, setPreferences] = useState<UserNewsPreference[]>([]);

  // Edit states
  const [editMode, setEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<ProfileType>>({});
  const [newGame, setNewGame] = useState("");
  const [showAddGame, setShowAddGame] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [syncingGames, setSyncingGames] = useState(false);
  const [showManualSteamInput, setShowManualSteamInput] = useState(false);
  const [manualSteamId, setManualSteamId] = useState('');
  const [linkingManually, setLinkingManually] = useState(false);

  // Gamification state
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusGained, setBonusGained] = useState<number | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingNameplate, setUploadingNameplate] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setUser(user);
    await loadProfileData(user.id);
  }

  async function loadProfileData(userId: string) {
    setLoading(true);
    const [profileData, socialData, gamesData, prefsData] = await Promise.all([
      getCurrentUserProfile(),
      getSocialAccounts(userId),
      getUserGames(userId),
      getNewsPreferences(userId)
    ]);

    setProfile(profileData);
    setEditedProfile(profileData || {});
    setSocialAccounts(socialData);
    setGames(gamesData);
    setPreferences(prefsData);
    setLoading(false);
  }

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    await updateProfile(user.id, editedProfile);
    const updated = await getCurrentUserProfile();
    setProfile(updated);
    setEditMode(false);
    setSaving(false);
  }

  async function handleAddGame(gameName: string) {
    if (!user || !gameName.trim()) return;
    const added = await addUserGame(user.id, gameName.trim());
    if (added) {
      const updatedGames = await getUserGames(user.id);
      setGames(updatedGames);
      setNewGame("");
      setShowAddGame(false);
    }
  }

  async function handleRemoveGame(gameId: string) {
    if (!user) return;
    const success = await removeUserGame(user.id, gameId);
    if (success) {
      setGames(games.filter(g => g.id !== gameId));
    }
  }

  async function handleToggleFavorite(gameId: string, currentStatus: boolean) {
    if (!user) return;
    const success = await toggleFavoriteGame(user.id, gameId, !currentStatus);
    if (success) {
      setGames(games.map(g =>
        g.id === gameId ? { ...g, is_favorite: !currentStatus } : g
      ));
    }
  }

  async function handleAddPreference(tag: string) {
    if (!user) return;
    const added = await addNewsPreference(user.id, tag);
    if (added) {
      setPreferences([...preferences, added]);
    }
  }

  async function handleRemovePreference(prefId: string) {
    if (!user) return;
    const success = await removeNewsPreference(user.id, prefId);
    if (success) {
      setPreferences(preferences.filter(p => p.id !== prefId));
    }
  }

  async function handleSteamLink() {
    const popup = window.open(
      getSteamLoginUrl(window.location.origin),
      'Steam Login',
      'width=800,height=600'
    );

    window.addEventListener('message', async (e) => {
      if (e.data.type === 'STEAM_LINKED' && user) {
        const { steamId, personaName, profileUrl, avatarUrl } = e.data;
        await linkSocialAccount(user.id, 'steam', steamId, personaName, avatarUrl, profileUrl);
        const updated = await getSocialAccounts(user.id);
        setSocialAccounts(updated);
        // Reload profile to get synced avatar/name
        const updatedProfile = await getCurrentUserProfile();
        setProfile(updatedProfile);
        setEditedProfile(updatedProfile || {});
        popup?.close();

        // Sync Steam games in background
        setSyncingGames(true);
        try {
          // Save Steam profile data
          const steamProfileData = await fetchSteamProfile(steamId);
          if (steamProfileData && steamProfileData.steam_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await saveSteamProfile(user.id, steamProfileData as any);
          }
          // Import Steam games
          await syncSteamGames(user.id, steamId);
          // Reload games
          const updatedGames = await getUserGames(user.id);
          setGames(updatedGames);
        } catch (err) {
          console.error('Error syncing Steam data:', err);
        } finally {
          setSyncingGames(false);
        }
      }
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner' | 'nameplate') {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (type === 'avatar') setUploadingAvatar(true);
    if (type === 'banner') setUploadingBanner(true);
    if (type === 'nameplate') setUploadingNameplate(true);

    try {
      let url: string | null = null;
      if (type === 'avatar') url = await uploadAvatar(user.id, file);
      if (type === 'banner') url = await uploadBanner(user.id, file);
      if (type === 'nameplate') url = await uploadNameplate(user.id, file);

      if (url) {
        const updatedProfile = await getCurrentUserProfile();
        setProfile(updatedProfile);
        setEditedProfile(updatedProfile || {});
        toast({
          title: "Image Uploaded",
          description: `Your ${type} has been updated successfully.`,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${type}. The file might be too large or invalid.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Error",
        description: "An unexpected error occurred while uploading. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      if (type === 'banner') setUploadingBanner(false);
      if (type === 'nameplate') setUploadingNameplate(false);
    }
  }

  async function handleClaimDailyBonus() {
    if (!user) return;
    setClaimingBonus(true);
    try {
      const xpGained = await claimDailyBonus(user.id);
      if (xpGained > 0) {
        setBonusGained(xpGained);
        const updated = await getCurrentUserProfile();
        setProfile(updated);
        setEditedProfile(updated || {});

        // Show floating text for +XP and Streak
        setTimeout(() => setBonusGained(null), 3000);
      } else {
        alert("You've already claimed your daily bonus today!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClaimingBonus(false);
    }
  }

  async function handleManualSteamLink() {
    if (!user || !manualSteamId.trim()) return;
    setLinkingManually(true);
    try {
      // Extract Steam ID from URL or use directly
      let steamId = manualSteamId.trim();
      // Handle profile URLs like https://steamcommunity.com/profiles/76561198xxxxx
      const profileMatch = steamId.match(/steamcommunity\.com\/profiles\/(\d+)/);
      if (profileMatch) steamId = profileMatch[1];
      // Handle vanity URLs like https://steamcommunity.com/id/vanityname
      const vanityMatch = steamId.match(/steamcommunity\.com\/id\/([^/]+)/);
      if (vanityMatch) {
        // Resolve vanity URL to Steam ID
        try {
          const res = await fetch(`/api/steam/ISteamUser/ResolveVanityURL/v1/?key=${import.meta.env.VITE_STEAM_API_KEY}&vanityurl=${vanityMatch[1]}`);
          const data = await res.json();
          if (data.response?.steamid) {
            steamId = data.response.steamid;
          }
        } catch (err) {
          console.error('Error resolving vanity URL:', err);
        }
      }

      // Fetch Steam profile
      const steamProfileData = await fetchSteamProfile(steamId);
      if (!steamProfileData) {
        alert('Could not find a Steam profile with that ID. Make sure your profile is public.');
        return;
      }

      // Link the account
      await linkSocialAccount(
        user.id,
        'steam',
        steamId,
        steamProfileData.persona_name || 'Steam User',
        steamProfileData.avatar_full || undefined,
        steamProfileData.profile_url || undefined
      );

      // Save Steam profile
      if (steamProfileData.steam_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await saveSteamProfile(user.id, steamProfileData as any);
      }

      // Refresh social accounts and profile
      const updated = await getSocialAccounts(user.id);
      setSocialAccounts(updated);
      const updatedProfile = await getCurrentUserProfile();
      setProfile(updatedProfile);
      setEditedProfile(updatedProfile || {});

      // Sync games in background
      setSyncingGames(true);
      try {
        await syncSteamGames(user.id, steamId);
        const updatedGames = await getUserGames(user.id);
        setGames(updatedGames);
      } finally {
        setSyncingGames(false);
      }

      setShowManualSteamInput(false);
      setManualSteamId('');
    } catch (err) {
      console.error('Error linking Steam manually:', err);
      alert('Something went wrong. Please check the Steam ID and try again.');
    } finally {
      setLinkingManually(false);
    }
  }

  async function handleUnlink(provider: string) {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const success = await unlinkSocialAccount(user.id, provider as any);
    if (success) {
      setSocialAccounts(socialAccounts.filter(s => s.provider !== provider));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const steamAccount = socialAccounts.find(s => s.provider === 'steam');
  const discordAccount = socialAccounts.find(s => s.provider === 'discord');
  const epicAccount = socialAccounts.find(s => s.provider === 'epic');
  const totalPlaytime = games.reduce((sum, g) => sum + (g.playtime_hours || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* ======================================== */}
      {/* HERO BANNER                              */}
      {/* ======================================== */}
      <div className="relative overflow-hidden group/banner">
        {/* Background Image or Gradient */}
        {profile?.banner_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${profile.banner_url})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 dark:from-primary/20 dark:via-accent/10 dark:to-transparent" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.15),_transparent_60%)] pointer-events-none" />

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />

        {/* Back to Home Button */}
        <div className="absolute top-4 left-4 z-20">
          <Link to="/">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 backdrop-blur-md bg-background/60 hover:bg-background/90 border border-border/50 shadow-md"
            >
              <ArrowLeft className="h-4 w-4" />
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </Button>
          </Link>
        </div>

        {/* Banner Upload Button (Always visible on hover for easier discovery) */}
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover/banner:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 backdrop-blur-md bg-background/50 hover:bg-background/80"
            onClick={() => document.getElementById('banner-upload')?.click()}
          >
            {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit2 className="h-4 w-4" />}
            {profile?.banner_url ? 'Change Banner' : 'Add Profile Banner'}
          </Button>
          <input
            id="banner-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarUpload(e, 'banner')}
          />
        </div>

        <div className="relative container max-w-5xl mx-auto px-4 pt-16 pb-12">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">

            {/* Avatar & Nameplate Container */}
            <div className="relative flex justify-center items-center h-40 w-40 shrink-0">

              {/* Nameplate (Overwatch style border/background) */}
              {profile?.nameplate_url && (
                <div
                  className="absolute inset-[-20%] bg-contain bg-center bg-no-repeat z-0 pointer-events-none"
                  style={{ backgroundImage: `url(${profile.nameplate_url})` }}
                />
              )}

              {/* Avatar Box */}
              <div className="group/avatar relative z-10">
                <Avatar className="h-32 w-32 rounded-xl border-4 border-background/80 shadow-2xl cursor-pointer ring-2 ring-primary/20 bg-background transition-transform hover:scale-105" onClick={() => document.getElementById('avatar-upload')?.click()}>
                  <AvatarImage className="rounded-xl object-cover" src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="rounded-xl text-5xl font-bold bg-gradient-to-br from-primary/20 to-accent/20">
                    {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Avatar Upload overlay */}
                <div
                  className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  ) : (
                    <Edit2 className="h-8 w-8 text-white" />
                  )}
                </div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e, 'avatar')}
                />

                {/* Nameplate Upload overlay (Edit Mode Only) */}
                {editMode && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-3 -right-3 h-8 w-8 rounded-full shadow-lg z-20"
                    onClick={() => document.getElementById('nameplate-upload')?.click()}
                    title="Change Nameplate/Border"
                  >
                    {uploadingNameplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </Button>
                )}
                <input
                  id="nameplate-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarUpload(e, 'nameplate')}
                />

                {/* Online indicator */}
                <div className="absolute -bottom-2 -left-2 h-6 w-6 rounded-full bg-green-500 border-4 border-background shadow-lg z-20" title="Online" />
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              {editMode ? (
                <div className="space-y-3 max-w-md">
                  <Input
                    value={editedProfile.display_name || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, display_name: e.target.value })}
                    placeholder="Display Name"
                    className="text-xl font-bold bg-background/50 backdrop-blur-sm"
                  />
                  <Input
                    value={editedProfile.username || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    placeholder="Username"
                    className="bg-background/50 backdrop-blur-sm"
                  />
                  <Textarea
                    value={editedProfile.about_me || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, about_me: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows={2}
                    className="bg-background/50 backdrop-blur-sm"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {profile?.display_name || 'Set Your Name'}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    @{profile?.username || 'username'}
                  </p>
                  <p className="text-sm text-foreground/70 mt-2 max-w-lg">
                    {profile?.about_me || 'No bio yet. Click Edit Profile to add one!'}
                  </p>
                </>
              )}
            </div>

            {/* Action Buttons & Daily Bonus */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {/* Daily Bonus Button */}
              {!editMode && (
                <Button
                  onClick={handleClaimDailyBonus}
                  disabled={claimingBonus || (profile?.daily_bonus_claimed_at && new Date(profile.daily_bonus_claimed_at).toDateString() === new Date().toDateString())}
                  className={`gap-2 relative ${!(profile?.daily_bonus_claimed_at && new Date(profile.daily_bonus_claimed_at).toDateString() === new Date().toDateString()) ? 'animate-pulse bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-secondary text-secondary-foreground'}`}
                >
                  {claimingBonus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {profile?.daily_bonus_claimed_at && new Date(profile.daily_bonus_claimed_at).toDateString() === new Date().toDateString() ? 'Bonus Claimed' : 'Claim Daily +50 XP'}

                  {/* Floating XP Animation */}
                  {bonusGained !== null && (
                    <span className="absolute -top-8 text-yellow-500 font-bold text-lg animate-bounce">
                      +{bonusGained} XP!
                    </span>
                  )}
                </Button>
              )}

              {/* Edit Mode Toggles */}
              {editMode ? (
                <>
                  <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Profile
                  </Button>
                  <Button variant="outline" onClick={() => { setEditMode(false); setEditedProfile(profile || {}); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setEditMode(true)} className="gap-2 bg-background/50 backdrop-blur-sm">
                  <Edit2 className="h-4 w-4" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* MAIN CONTENT                             */}
      {/* ======================================== */}
      <div className="container max-w-5xl mx-auto px-4 pb-16 space-y-8 relative z-10">

        {/* ---- STATS ROW ---- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Trophy className="h-5 w-5 text-yellow-500" />}
            label="Tier"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value={String((profile as any)?.tier || profile?.level || 1)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sub={`${(((profile as any)?.xp_season || profile?.xp || 0) % XP_PER_TIER)} / ${XP_PER_TIER} XP to next`}
            highlight={true}
          />
          <StatCard
            icon={<Zap className="h-5 w-5 text-orange-500" />}
            label="Daily Streak"
            value={String(profile?.daily_streak || 0)}
            sub={profile?.daily_streak ? "days in a row!" : "Claim bonus to start"}
          />
          <StatCard
            icon={<Gamepad2 className="h-5 w-5 text-primary" />}
            label="Games"
            value={String(games.length)}
            sub={`${games.filter(g => g.is_favorite).length} favorites`}
          />
          <StatCard
            icon={<SteamIcon className="h-5 w-5 text-[#1b2838] dark:text-white" />}
            label="Steam"
            value={steamAccount ? 'Connected' : 'Not Linked'}
            sub={steamAccount ? `as ${steamAccount.username}` : 'Link your account'}
            highlight={!!steamAccount}
          />
        </div>

        {/* ---- CONNECTED ACCOUNTS ---- */}
        <Section title="Connected Accounts" icon={<LinkIcon className="h-5 w-5" />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Steam */}
            <AccountCard
              icon={<SteamIcon className="h-6 w-6 text-white" />}
              name="Steam"
              bgColor="bg-[#1b2838]"
              connected={!!steamAccount}
              username={steamAccount?.username}
              onConnect={() => setShowManualSteamInput(!showManualSteamInput)}
              onDisconnect={() => handleUnlink('steam')}
              connectColor="bg-[#1b2838] hover:bg-[#2a475e] text-white"
            />
            {/* Discord */}
            <AccountCard
              icon={<MessageCircle className="h-6 w-6 text-white" />}
              name="Discord"
              bgColor="bg-[#5865F2]"
              connected={!!discordAccount}
              username={discordAccount?.username}
              onConnect={() => { }}
              onDisconnect={() => handleUnlink('discord')}
              connectColor="bg-[#5865F2] hover:bg-[#4752C4] text-white"
            />
            {/* Epic Games */}
            <AccountCard
              icon={<Monitor className="h-6 w-6 text-black dark:text-white" />}
              name="Epic Games"
              bgColor="bg-white dark:bg-zinc-800 border"
              connected={!!epicAccount}
              username={epicAccount?.username}
              onConnect={() => { }}
              onDisconnect={() => handleUnlink('epic')}
              connectColor=""
            />
          </div>

          {/* Manual Steam ID Input */}
          {showManualSteamInput && !steamAccount && (
            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <p className="text-sm font-medium mb-2">Link your Steam account</p>
              <p className="text-xs text-muted-foreground mb-3">
                Paste your Steam profile URL or Steam ID (e.g., <code>76561198xxxxxxxxx</code>)
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://steamcommunity.com/id/yourname or 76561198..."
                  value={manualSteamId}
                  onChange={(e) => setManualSteamId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSteamLink()}
                  className="flex-1"
                />
                <Button
                  onClick={handleManualSteamLink}
                  disabled={linkingManually || !manualSteamId.trim()}
                  className="bg-[#1b2838] hover:bg-[#2a475e] text-white gap-2"
                >
                  {linkingManually ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SteamIcon className="h-4 w-4" />
                  )}
                  {linkingManually ? 'Linking...' : 'Link'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowManualSteamInput(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {syncingGames && (
                <div className="flex items-center gap-2 mt-3 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing your Steam library...
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ---- MY GAMES ---- */}
        <Section
          title="My Games"
          icon={<Gamepad2 className="h-5 w-5" />}
          action={
            <Button size="sm" onClick={() => setShowAddGame(!showAddGame)} className="gap-1">
              <Plus className="h-4 w-4" />
              Add Game
            </Button>
          }
        >
          {/* Add Game Input */}
          {showAddGame && (
            <div className="flex gap-2 p-4 bg-secondary/30 rounded-lg border border-border/50 mb-4">
              <Input
                placeholder="Search for a game..."
                value={newGame}
                onChange={(e) => setNewGame(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGame(newGame)}
                className="flex-1"
              />
              <Button onClick={() => handleAddGame(newGame)}>Add</Button>
              <Button variant="ghost" onClick={() => setShowAddGame(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Popular Games Quick Add */}
          {showAddGame && (
            <div className="mb-4 bg-card p-4 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">Quick Add Favorites</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_GAMES.slice(0, 8).map(game => (
                  <Badge
                    key={game}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors py-1.5 px-3"
                    onClick={() => handleAddGame(game)}
                  >
                    + {game}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Featured Showcase (Only show favorites at top) */}
          {games.filter(g => g.is_favorite).length > 0 && (
            <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <h3 className="font-semibold text-lg tracking-tight">Game Collector Showcase</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {games.filter(g => g.is_favorite).map(game => (
                  <div key={`featured-${game.id}`} className="relative group overflow-hidden rounded-lg border border-border/50 bg-card text-center hover:border-primary/50 transition-colors h-48">
                    {game.image_url ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-300"
                        style={{ backgroundImage: `url(${game.image_url})` }}
                      />
                    ) : (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-transparent" />
                    )}
                    {/* Content overlay */}
                    <div className="relative z-10 flex flex-col h-full bg-background/50 p-6 backdrop-blur-sm">
                      {!game.image_url && <Gamepad2 className="h-12 w-12 mx-auto mb-4 text-primary/40 group-hover:text-primary transition-colors duration-300" />}
                      <div className="mt-auto">
                        <p className="font-bold text-lg truncate drop-shadow-md" title={game.game_name}>{game.game_name}</p>
                        {game.platform && (
                          <span className="inline-block mt-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-secondary/80 text-secondary-foreground rounded-full backdrop-blur-md">
                            {game.platform}
                          </span>
                        )}
                        {game.playtime_hours ? (
                          <p className="text-xs text-foreground mt-3 font-semibold drop-shadow-md">
                            {game.playtime_hours.toLocaleString()} hrs played
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 backdrop-blur-sm"
                      onClick={() => handleToggleFavorite(game.id, true)}
                      title="Remove from showcase"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">All Games ({games.length})</h3>
            <p className="text-sm text-muted-foreground">Click the star to add to your showcase</p>
          </div>

          {/* Games Grid */}
          {games.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gamepad2 className="h-16 w-16 mx-auto mb-4 opacity-15" />
              <p className="text-lg font-medium">No games added yet</p>
              <p className="text-sm">Add your favorite games to get personalized news</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {games.map(game => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-card-foreground/5 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      className="shrink-0"
                      onClick={() => handleToggleFavorite(game.id, game.is_favorite)}
                    >
                      <Star
                        className={`h-5 w-5 transition-colors ${game.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400'
                          }`}
                      />
                    </button>
                    {game.image_url ? (
                      <div
                        className="h-12 w-12 rounded-md bg-cover bg-center shrink-0"
                        style={{ backgroundImage: `url(${game.image_url})` }}
                      />
                    ) : (
                      <div className="p-3 bg-secondary rounded-lg shrink-0">
                        <Gamepad2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{game.game_name}</p>
                      {game.platform && (
                        <p className="text-xs text-muted-foreground">{game.platform}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleRemoveGame(game.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ---- NEWS PREFERENCES ---- */}
        <Section title="News Preferences" icon={<Newspaper className="h-5 w-5" />}>
          <p className="text-sm text-muted-foreground mb-4">
            Select topics you're interested in. We'll prioritize news matching your preferences.
          </p>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const isSelected = preferences.some(p => p.tag.toLowerCase() === cat.id.toLowerCase());
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (isSelected) {
                      const pref = preferences.find(p => p.tag.toLowerCase() === cat.id.toLowerCase());
                      if (pref) handleRemovePreference(pref.id);
                    } else {
                      handleAddPreference(cat.id);
                    }
                  }}
                  className={`
                    inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                    border transition-all duration-200
                    ${isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                      : 'bg-secondary/50 text-secondary-foreground border-border/50 hover:border-primary/50 hover:bg-primary/10'
                    }
                  `}
                >
                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {preferences.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                Your selections ({preferences.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {preferences.map(pref => (
                  <Badge
                    key={pref.id}
                    className="cursor-pointer gap-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => handleRemovePreference(pref.id)}
                  >
                    #{pref.tag}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ---- ACCOUNT SETTINGS ---- */}
        <Section title="Account" icon={<Settings className="h-5 w-5" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-border/50 bg-card">
              <div className="flex items-center gap-3 mb-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Email</p>
              </div>
              <p className="font-medium pl-7">{user?.email}</p>
            </div>
            <div className="p-4 rounded-lg border border-border/50 bg-card">
              <div className="flex items-center gap-3 mb-1">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Password</p>
              </div>
              <div className="flex items-center justify-between pl-7">
                <p className="font-medium">••••••••</p>
                <Button variant="ghost" size="sm" className="text-primary">Change</Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ======================================== */
/* HELPER COMPONENTS                        */
/* ======================================== */

function StatCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`
      p-4 rounded-xl border transition-all
      ${highlight
        ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-sm shadow-primary/10'
        : 'border-border/50 bg-card hover:border-border'
      }
    `}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function Section({ title, icon, children, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function AccountCard({ icon, name, bgColor, connected, username, onConnect, onDisconnect, connectColor }: {
  icon: React.ReactNode;
  name: string;
  bgColor: string;
  connected: boolean;
  username?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  connectColor: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-card-foreground/5 transition-colors">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground truncate">
          {connected ? `Connected as ${username}` : 'Not connected'}
        </p>
      </div>
      {connected ? (
        <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={onDisconnect}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className={`shrink-0 ${connectColor}`} onClick={onConnect}>
          <LinkIcon className="h-4 w-4 mr-1" />
          Link
        </Button>
      )}
    </div>
  );
}
