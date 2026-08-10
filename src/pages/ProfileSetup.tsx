import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { AvatarPicker, type AvatarValue } from "@/components/onboarding/AvatarPicker";
import { GameSearchInput, type GameOption } from "@/components/onboarding/GameSearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useProfile } from "@/contexts/ProfileContext";
import { BANNER_GRADIENTS, checkUsernameAvailable, completeOnboarding, saveStep1, saveStep2, saveStep3 } from "@/lib/onboardingService";
import { validateProfileContent } from "@/lib/profileModeration";

const BANNERS = ["bn1", "bn2", "bn3", "bn4", "bn5", "bn6"];
const PLAYER_TYPES = ["Casual", "Competitive", "Completionist", "Social"];
const GENRES = ["Action RPG", "FPS", "Strategy", "MOBA", "Racing", "Sports", "Indie", "Open World", "Horror", "Sandbox"];
const POPULAR_GAMES: GameOption[] = [
  { id: "elden-ring", name: "Elden Ring", genre: "Action RPG", coverUrl: "" },
  { id: "valorant", name: "Valorant", genre: "FPS", coverUrl: "" },
  { id: "counter-strike-2", name: "Counter-Strike 2", genre: "FPS", coverUrl: "" },
  { id: "hollow-knight", name: "Hollow Knight", genre: "Indie", coverUrl: "" },
  { id: "minecraft", name: "Minecraft", genre: "Sandbox", coverUrl: "" },
  { id: "fortnite", name: "Fortnite", genre: "Battle Royale", coverUrl: "" },
  { id: "league-of-legends", name: "League of Legends", genre: "MOBA", coverUrl: "" },
  { id: "apex-legends", name: "Apex Legends", genre: "Battle Royale", coverUrl: "" },
];

function SectionTitle({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return <div className="mb-5 flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><div><h2 className="text-base font-bold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div></div>;
}

export default function ProfileSetup() {
  const { user } = useAuthGate();
  const { refreshProfile } = useProfile();
  const navigate = useNavigate();
  const defaultName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "";
  const [displayName, setDisplayName] = useState(defaultName);
  const [username, setUsername] = useState(defaultName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
  const [bio, setBio] = useState("");
  const [bannerPreset, setBannerPreset] = useState("bn1");
  const [avatar, setAvatar] = useState<AvatarValue>({ type: "initials", initials: "T", color: "#3d59e0", url: null });
  const [playerType, setPlayerType] = useState("Casual");
  const [selectedGames, setSelectedGames] = useState<GameOption[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<GameOption[]>([]);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initials = (displayName || username || "T").slice(0, 2).toUpperCase();
    if (avatar.type === "initials") setAvatar((current) => ({ ...current, initials }));
  }, [avatar.type, displayName, username]);

  useEffect(() => {
    if (username.length < 3) { setUsernameAvailable(null); return; }
    const timeout = setTimeout(() => checkUsernameAvailable(username, user?.id).then(setUsernameAvailable), 350);
    return () => clearTimeout(timeout);
  }, [user?.id, username]);

  const shownGames = useMemo(() => searchResults.length ? searchResults : POPULAR_GAMES, [searchResults]);
  const handleResults = useCallback((games: GameOption[]) => setSearchResults(games), []);
  const toggleGame = (game: GameOption) => setSelectedGames((current) => current.some((item) => item.id === game.id) ? current.filter((item) => item.id !== game.id) : [...current, game]);

  async function finish() {
    if (!user || displayName.trim().length < 2 || username.length < 3 || usernameAvailable === false || selectedGames.length < 3) return;
    setSaving(true);
    try {
      const validation = await validateProfileContent({ displayName, username, aboutMe: bio });
      if (!validation.isSafe) throw new Error(validation.message || "Please replace the unsafe wording before continuing.");
      await saveStep1(user.id, { displayName: displayName.trim(), username, bio: bio.trim(), bannerPreset, avatarUrl: avatar.url, avatarType: avatar.type, avatarInitials: avatar.initials, avatarColor: avatar.color });
      await saveStep2(user.id, { platforms: [], skillLevel: playerType });
      await saveStep3(user.id, { favGameIds: selectedGames.map((game) => game.id), favGenres: genres, favGames: selectedGames.map((game) => ({ id: game.id, name: game.name, coverUrl: game.coverUrl })) });
      await completeOnboarding(user.id);
      await refreshProfile();
      navigate("/", { replace: true });
      toast.success("Your Talus profile is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile setup could not be completed.");
    } finally { setSaving(false); }
  }

  return <SiteLayout><main className="space-y-4 pb-8"><header className="border-b px-1 pb-4"><h1 className="text-2xl font-bold">Profile Setup</h1></header>
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <SectionTitle number={1} title="Your Profile" subtitle="Choose how you appear across Talus." />
      <div className="flex flex-col items-center gap-5">
        <AvatarPicker username={username} userId={user?.id ?? ""} value={avatar} onChange={setAvatar} />
        <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">{BANNERS.map((banner) => <button key={banner} type="button" aria-label={`Choose ${banner} banner`} onClick={() => setBannerPreset(banner)} className="relative h-12 rounded-lg border-2" style={{ background: BANNER_GRADIENTS[banner], borderColor: bannerPreset === banner ? "#3d59e0" : "transparent" }}>{bannerPreset === banner && <Check className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-primary p-0.5 text-white" />}</button>)}</div>
        <div className="grid w-full gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Display Name<Input className="mt-1.5" value={displayName} maxLength={30} onChange={(event) => setDisplayName(event.target.value)} /></label><label className="text-sm font-semibold">Username<div className="relative mt-1.5"><Input className="pr-9" value={username} maxLength={20} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />{usernameAvailable && <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}</div></label></div>
        <label className="w-full text-sm font-semibold">Bio <span className="font-normal text-muted-foreground">(Optional)</span><Textarea className="mt-1.5" rows={3} value={bio} maxLength={160} onChange={(event) => setBio(event.target.value)} /></label>
      </div>
    </section>
    <section className="rounded-2xl border bg-card p-5 sm:p-6"><SectionTitle number={2} title="Your Games" subtitle="Pick at least three games and tell us how you play." />
      <div className="space-y-5"><div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">What Type Of Player Are You?</p><div className="flex flex-wrap gap-2">{PLAYER_TYPES.map((type) => <button key={type} type="button" onClick={() => setPlayerType(type)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${playerType === type ? "border-primary bg-primary text-primary-foreground" : "bg-secondary"}`}>{type}</button>)}</div></div>
        <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Favourite Games · {selectedGames.length} Selected</p><GameSearchInput onResults={handleResults} onClear={() => setSearchResults([])} /><div className="mt-3 flex flex-wrap gap-2">{shownGames.map((game) => { const selected = selectedGames.some((item) => item.id === game.id); return <button key={game.id} type="button" onClick={() => toggleGame(game)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? "border-primary bg-primary/10 text-primary" : "bg-secondary"}`}>{selected ? "✓ " : "+ "}{game.name}</button>; })}</div></div>
        <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Favourite Genres <span className="font-normal normal-case">(Optional)</span></p><div className="flex flex-wrap gap-2">{GENRES.map((genre) => <button key={genre} type="button" onClick={() => setGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${genres.includes(genre) ? "border-primary bg-primary/10 text-primary" : "bg-secondary"}`}>{genre}</button>)}</div></div>
      </div>
    </section>
    <Button className="h-12 w-full gap-2" onClick={finish} disabled={saving || displayName.trim().length < 2 || username.length < 3 || usernameAvailable === false || selectedGames.length < 3}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Complete Profile And Enter Talus</Button>
  </main></SiteLayout>;
}
