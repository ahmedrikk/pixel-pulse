import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Camera,
  Gamepad2,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useDeleteReview, useMyReviews } from "@/hooks/useGameReviews";
import {
  addUserGame,
  getUserGames,
  removeUserGame,
  toggleFavoriteGame,
  updateProfile,
  uploadAvatar,
  uploadBanner,
  type UserGame,
} from "@/lib/profile";
import { PROFILE_AVATARS, PROFILE_BANNERS } from "@/lib/profileAssets";
import { validateProfileContent } from "@/lib/profileModeration";
import { supabase } from "@/integrations/supabase/client";

type AssetPicker = "avatar" | "banner" | null;

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuthGate();
  const { profile, isLoading: profileLoading, refreshProfile, setCachedProfile } = useProfile();
  const { data: reviews = [] } = useMyReviews(user?.id);
  const deleteReview = useDeleteReview();
  const [games, setGames] = useState<UserGame[]>([]);
  const [canonicalGames, setCanonicalGames] = useState<Record<string, { id: string; cover: string | null }>>({});
  const [gamesLoading, setGamesLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [assetPicker, setAssetPicker] = useState<AssetPicker>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [newGame, setNewGame] = useState("");
  const [showAddGame, setShowAddGame] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moderationMessage, setModerationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/", { replace: true });
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.about_me ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setGamesLoading(true);
    getUserGames(user.id).then((rows) => {
      if (active) setGames(rows);
    }).finally(() => {
      if (active) setGamesLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const names = [...new Set(games.map((game) => game.game_name).filter(Boolean))];
    if (names.length === 0) {
      setCanonicalGames({});
      return;
    }
    supabase.from("games").select("id, name, cover_image").in("name", names).then(({ data }) => {
      setCanonicalGames(Object.fromEntries((data ?? []).map((game) => [game.name.toLowerCase(), { id: game.id, cover: game.cover_image }])));
    });
  }, [games]);

  const favoriteGames = useMemo(() => {
    const favorites = games.filter((game) => game.is_favorite);
    return favorites.length ? favorites : games;
  }, [games]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setModerationMessage(null);
    try {
      const validation = await validateProfileContent({ displayName, username, aboutMe: bio });
      if (!validation.isSafe) {
        setModerationMessage(validation.message || "Please replace the unsafe wording before saving.");
        return;
      }
      const updated = await updateProfile(user.id, {
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        about_me: bio.trim(),
      });
      if (!updated) throw new Error("Profile update failed");
      setCachedProfile(updated);
      setEditOpen(false);
      toast({ title: "Profile updated" });
    } catch (error) {
      toast({ title: "Could not save profile", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function equipAsset(type: Exclude<AssetPicker, null>, url: string) {
    if (!user) return;
    setUploading(true);
    try {
      const updated = await updateProfile(user.id, type === "avatar" ? { avatar_url: url } : { banner_url: url });
      if (!updated) throw new Error("Image update failed");
      setCachedProfile(updated);
      setAssetPicker(null);
    } finally {
      setUploading(false);
    }
  }

  async function uploadAsset(type: Exclude<AssetPicker, null>, file?: File) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = type === "avatar" ? await uploadAvatar(user.id, file) : await uploadBanner(user.id, file);
      if (!url) throw new Error("Upload failed");
      await refreshProfile();
      setAssetPicker(null);
    } catch {
      toast({ title: "Could not upload image", description: "Use a JPG, PNG, or WebP file under 5 MB.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function addGame() {
    if (!user || !newGame.trim()) return;
    const added = await addUserGame(user.id, newGame.trim(), undefined, games.length < 6);
    if (!added) return;
    setGames(await getUserGames(user.id));
    setNewGame("");
    setShowAddGame(false);
  }

  async function toggleFavorite(game: UserGame) {
    if (!user) return;
    if (await toggleFavoriteGame(user.id, game.id, !game.is_favorite)) {
      setGames((current) => current.map((item) => item.id === game.id ? { ...item, is_favorite: !item.is_favorite } : item));
    }
  }

  async function deleteGame(game: UserGame) {
    if (!user) return;
    if (await removeUserGame(user.id, game.id)) setGames((current) => current.filter((item) => item.id !== game.id));
  }

  if (authLoading || profileLoading || !user || !profile) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  const bannerIsGradient = profile.banner_url?.startsWith("linear-gradient") || profile.banner_url?.startsWith("radial-gradient");

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SiteLayout>
        <main className="overflow-hidden rounded-xl border bg-card">
          <section className="relative">
            <button type="button" onClick={() => setAssetPicker("banner")} className="group relative block h-44 w-full overflow-hidden bg-secondary sm:h-52" aria-label="Change profile banner">
              {profile.banner_url ? (
                bannerIsGradient
                  ? <span className="absolute inset-0" style={{ background: profile.banner_url }} />
                  : <img src={profile.banner_url} alt="Profile banner" className="h-full w-full object-cover" />
              ) : <span className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-secondary" />}
              <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
              <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-card/90 px-2.5 py-1.5 text-xs font-semibold opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <Camera className="h-3.5 w-3.5" /> Change banner
              </span>
            </button>

            <div className="relative px-5 pb-5 sm:px-7">
              <button type="button" onClick={() => setAssetPicker("avatar")} className="group absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 overflow-hidden rounded-full border-4 border-card bg-secondary shadow-md" aria-label="Change profile picture">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name || "Profile"} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-black">{(profile.display_name || profile.username || "T").slice(0, 2).toUpperCase()}</span>}
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-6 w-6" /></span>
              </button>

              <div className="flex justify-end pt-3">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Edit profile</Button>
              </div>
              <div className="mt-9 text-center">
                <h1 className="text-2xl font-bold normal-case sm:text-3xl">{profile.display_name || profile.username}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">@{profile.username}</p>
                <p className="mx-auto mt-4 max-w-2xl whitespace-pre-wrap text-card-title leading-6 text-foreground/80">{profile.about_me || "No information available right now."}</p>
              </div>
            </div>
          </section>

          <div className="border-t px-5 py-6 sm:px-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Gamepad2 className="h-5 w-5" /> My games</h2>
              <Button size="sm" onClick={() => setShowAddGame((value) => !value)} className="gap-1.5"><Plus className="h-4 w-4" /> Add game</Button>
            </div>
            {showAddGame && (
              <div className="mb-4 flex gap-2 rounded-xl bg-secondary/60 p-3">
                <Input value={newGame} onChange={(event) => setNewGame(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addGame()} placeholder="Search or enter a game" />
                <Button onClick={addGame} disabled={!newGame.trim()}>Add</Button>
              </div>
            )}
            {gamesLoading ? <div className="h-44 animate-pulse rounded-xl bg-secondary" /> : favoriteGames.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Add games to build your profile and personalize Talus.</div>
            ) : (
              <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                {favoriteGames.map((game) => {
                  const canonical = canonicalGames[game.game_name.toLowerCase()];
                  return (
                  <article key={game.id} className="group relative w-36 shrink-0 snap-start overflow-hidden rounded-xl border bg-card">
                    <Link to={`/reviews/${canonical?.id ?? encodeURIComponent(game.game_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}`} className="block">
                    <div className="aspect-[4/3] bg-secondary">
                      {(canonical?.cover || game.image_url) ? <img src={canonical?.cover || game.image_url || ""} alt={game.game_name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Gamepad2 className="h-8 w-8 text-muted-foreground" /></span>}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-bold normal-case" title={game.game_name}>{game.game_name}</p>
                      <p className="mt-1 text-tiny-label text-muted-foreground">{game.playtime_hours ? `${game.playtime_hours.toLocaleString()} hours` : game.platform || "Community game"}</p>
                    </div>
                    </Link>
                    <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => toggleFavorite(game)} className="rounded-full bg-card/90 p-1.5 shadow" aria-label="Toggle favorite"><Star className={`h-3.5 w-3.5 ${game.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} /></button>
                      <button onClick={() => deleteGame(game)} className="rounded-full bg-card/90 p-1.5 text-destructive shadow" aria-label="Remove game"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </article>
                )})}
              </div>
            )}
          </div>

          <div className="border-t px-5 py-6 sm:px-7">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Star className="h-5 w-5" /> My reviews ({reviews.length})</h2>
            {reviews.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Your game reviews will appear here.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {reviews.slice(0, 6).map((review) => (
                  <article key={review.id} className="relative rounded-xl border p-3">
                    <Link to={`/reviews/${review.gameId}`} className="flex gap-3 pr-5">
                    <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {review.gameCover ? <img src={review.gameCover} alt="" className="h-full w-full object-cover" /> : <Gamepad2 className="m-3 h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold normal-case">{review.gameName}</p>
                      </div>
                      <p className="text-xs text-amber-500">{"★".repeat(Math.round(review.starRating))}{"☆".repeat(Math.max(0, 5 - Math.round(review.starRating)))}</p>
                      {review.reviewText && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{review.reviewText}</p>}
                    </div>
                    </Link>
                    <button onClick={() => deleteReview.mutate(review.id)} aria-label="Delete review" className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <Link to="/settings/account" className="flex items-center gap-2 border-t px-5 py-5 text-sm font-semibold transition-colors hover:bg-secondary/60 sm:px-7"><Settings className="h-4 w-4" /> Account settings</Link>
        </main>
      </SiteLayout>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update how other players see you on Talus.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Display name<Input className="mt-1.5" value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 30))} /></label>
            <label className="block text-sm font-semibold">Username<Input className="mt-1.5" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} /></label>
            <label className="block text-sm font-semibold">Bio<Textarea className="mt-1.5" value={bio} onChange={(event) => setBio(event.target.value.slice(0, 160))} rows={4} /><span className="mt-1 block text-right text-xs font-normal text-muted-foreground">{bio.length}/160</span></label>
            {moderationMessage && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{moderationMessage}</p>}
            <Button className="w-full" onClick={saveProfile} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save profile</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assetPicker !== null} onOpenChange={(open) => !open && setAssetPicker(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Choose {assetPicker}</DialogTitle><DialogDescription>Equip a Talus image or upload your own.</DialogDescription></DialogHeader>
          <div className={assetPicker === "avatar" ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid max-h-[48vh] grid-cols-2 gap-3 overflow-y-auto"}>
            {(assetPicker === "avatar" ? PROFILE_AVATARS : PROFILE_BANNERS).map((asset) => (
              <button key={asset.id} type="button" disabled={uploading} onClick={() => assetPicker && equipAsset(assetPicker, asset.url)} className="overflow-hidden rounded-xl border bg-secondary text-left transition hover:border-primary">
                <img src={asset.url} alt={asset.label} className={assetPicker === "avatar" ? "aspect-square w-full object-cover" : "h-24 w-full object-cover"} />
                <span className="block truncate px-2 py-2 text-xs font-semibold">{asset.label}</span>
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload your own
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => assetPicker && uploadAsset(assetPicker, event.target.files?.[0])} />
          </label>
        </DialogContent>
      </Dialog>
      <BottomNavBar />
    </div>
  );
}
