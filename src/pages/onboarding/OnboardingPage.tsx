import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarPicker, AvatarValue } from '@/components/onboarding/AvatarPicker';
import { GameSearchInput, GameOption } from '@/components/onboarding/GameSearchInput';
import {
  checkUsernameAvailable, saveStep1, saveStep2, saveStep3, completeOnboarding,
  BANNER_GRADIENTS,
} from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { useXP } from '@/contexts/XPContext';
import { TalusLogo } from '@/components/TalusLogo';

// ─── Constants ──────────────────────────────────────────────────────────────

const BANNERS = [
  { id: 'bn1', label: 'Ember Dawn' },
  { id: 'bn2', label: 'Midnight Pulse' },
  { id: 'bn3', label: 'Teal Forest' },
  { id: 'bn4', label: 'Crimson Night' },
  { id: 'bn5', label: 'Void Purple' },
  { id: 'bn6', label: 'Gold Surge' },
];

const PLATFORMS = [
  { id: 'playstation', label: 'PlayStation', icon: '🎮' },
  { id: 'xbox',        label: 'Xbox',        icon: '🟢' },
  { id: 'pc',          label: 'PC',          icon: '💻' },
  { id: 'nintendo',    label: 'Nintendo',    icon: '🔴' },
  { id: 'mobile',      label: 'Mobile',      icon: '📱' },
  { id: 'handheld',    label: 'Handheld',    icon: '🕹️' },
];

const SKILL_LEVELS = ['Casual', 'Mid', 'Hardcore', 'Pro'];

const POPULAR_GAMES: GameOption[] = [
  { id: 'elden-ring',    name: 'Elden Ring',            genre: 'Action RPG',    coverUrl: '' },
  { id: 'valorant',      name: 'Valorant',              genre: 'FPS',           coverUrl: '' },
  { id: 'cs2',           name: 'CS2',                   genre: 'FPS',           coverUrl: '' },
  { id: 'hollow-knight', name: 'Hollow Knight',         genre: 'Indie',         coverUrl: '' },
  { id: 'minecraft',     name: 'Minecraft',             genre: 'Sandbox',       coverUrl: '' },
  { id: 'fortnite',      name: 'Fortnite',              genre: 'Battle Royale', coverUrl: '' },
  { id: 'lol',           name: 'League of Legends',     genre: 'MOBA',          coverUrl: '' },
  { id: 'apex',          name: 'Apex Legends',          genre: 'Battle Royale', coverUrl: '' },
  { id: 'cod-bo6',       name: 'CoD: Black Ops 6',      genre: 'FPS',           coverUrl: '' },
  { id: 'cyberpunk',     name: 'Cyberpunk 2077',        genre: 'Action RPG',    coverUrl: '' },
  { id: 'gta-v',         name: 'GTA V',                 genre: 'Action',        coverUrl: '' },
  { id: 'rocket-league', name: 'Rocket League',         genre: 'Sports',        coverUrl: '' },
];

const GAME_EMOJIS: Record<string, string> = {
  'elden-ring': '⚔️', 'valorant': '🎯', 'cs2': '🔫', 'hollow-knight': '🌿',
  'minecraft': '⛏️', 'fortnite': '🏗️', 'lol': '🏆', 'apex': '🎯',
  'cod-bo6': '💥', 'cyberpunk': '🤖', 'gta-v': '🚗', 'rocket-league': '🏎️',
};

const GENRES = [
  'Action RPG', 'FPS', 'Strategy', 'MOBA', 'Racing',
  'Sports', 'Indie', 'Open World', 'Horror', 'Sandbox',
];

const BENEFIT_CARDS = [
  { icon: '⭐', iconBg: 'rgba(83,74,183,0.2)', label: 'Earn Battle Pass XP', desc: 'Every action earns XP — reading news, predicting matches, reviewing games.', xp: '+50 XP on signup' },
  { icon: '📰', iconBg: 'rgba(16,185,129,0.12)', label: 'Personalised feed', desc: 'News filtered to the games and genres you actually play.' },
  { icon: '🏆', iconBg: 'rgba(220,38,38,0.12)', label: 'Leaderboards', desc: 'Your username and frame appear on community leaderboards.' },
  { icon: '🔥', iconBg: 'rgba(217,119,6,0.12)', label: 'Season 1 Founder', desc: 'Join now and every reward carries a permanent Founder tag — never repeats.' },
  { icon: '🎯', iconBg: 'rgba(13,148,136,0.12)', label: 'Predict & win XP', desc: 'Call esports match outcomes and earn up to +65 XP per correct prediction.' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1.5">
      {children}
    </label>
  );
}

function StepCard({
  active,
  number,
  title,
  sub,
  children,
  footer,
}: {
  active?: boolean;
  number: number;
  title: string;
  sub: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: active ? '#534AB7' : 'rgba(255,255,255,0.08)', color: 'white' }}
        >
          {number}
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-white leading-tight">{title}</h3>
          <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 flex flex-col gap-4 flex-1 sm:px-5">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="mt-auto flex flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

function ProgBar({ step, pct }: { step: string; pct: number }) {
  return (
    <div className="flex-1 sm:mr-3">
      <p className="text-[9px] text-white/50 mb-1">{step}</p>
      <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full bg-[#534AB7] rounded-sm" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user } = useAuthGate();
  const { enableXP, addXP } = useXP();
  const navigate = useNavigate();
  const { state, setStep1, setStep2, setStep3, clear } = useOnboardingState();

  const [page, setPage] = useState<1 | 2>(() =>
    state.step1 && state.step2 ? 2 : 1
  );

  // Step 1 state
  const [displayName, setDisplayName] = useState(state.step1?.displayName ?? '');
  const [username, setUsername]       = useState(state.step1?.username ?? '');
  const [bio, setBio]                 = useState(state.step1?.bio ?? '');
  const [bannerPreset, setBannerPreset] = useState(state.step1?.bannerPreset ?? 'bn1');
  const [avatar, setAvatar]           = useState<AvatarValue>(
    state.step1
      ? { type: state.step1.avatarType, initials: state.step1.avatarInitials, color: state.step1.avatarColor, url: state.step1.avatarUrl } as AvatarValue
      : { type: 'initials', initials: 'GP', color: '#534AB7', url: null }
  );
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  // Step 2 state
  const [platforms, setPlatforms] = useState<string[]>(state.step2?.platforms ?? []);
  const [skill, setSkill]         = useState(state.step2?.skillLevel ?? 'Mid');

  // Step 3 state
  const [selectedIds, setSelectedIds]       = useState<string[]>(state.step3?.favGameIds ?? []);
  const [genres, setGenres]                 = useState<string[]>(state.step3?.favGenres ?? []);
  const [searchResults, setSearchResults]   = useState<GameOption[] | null>(null);
  // Cache of every game the user has seen (POPULAR + searched) so selections persist when search clears
  const [gameCache, setGameCache] = useState<Record<string, GameOption>>(() => {
    const m: Record<string, GameOption> = {};
    POPULAR_GAMES.forEach(g => { m[g.id] = g; });
    return m;
  });
  const handleSearchResults = useCallback((results: GameOption[]) => {
    setSearchResults(results);
    setGameCache(prev => {
      const next = { ...prev };
      for (const g of results) next[g.id] = g;
      return next;
    });
  }, []);

  // Loading
  const [p1Loading, setP1Loading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const awarded = useRef(false);

  // Auto-generate username from display name
  useEffect(() => {
    if (!displayName) { setUsername(''); return; }
    setUsername(generateUsername(displayName));
  }, [displayName]);

  // Sync avatar initials
  useEffect(() => {
    const initials = (displayName || username).slice(0, 2).toUpperCase() || 'GP';
    if (avatar.type === 'initials') setAvatar(prev => ({ ...prev, initials }));
  }, [displayName, username, avatar.type]);

  // Debounced username availability check
  const checkUsername = useCallback(async (u: string) => {
    if (u.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const ok = await checkUsernameAvailable(u);
    setUsernameStatus(ok ? 'available' : 'taken');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (username) checkUsername(username); }, 400);
    return () => clearTimeout(t);
  }, [username, checkUsername]);

  function togglePlatform(id: string) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleGame(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleGenre(g: string) {
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  const canContinuePage1 =
    displayName.length >= 2 &&
    username.length >= 3 &&
    usernameStatus === 'available' &&
    platforms.length >= 1;

  const canComplete = selectedIds.length >= 3;

  async function handlePage1Continue() {
    if (!user || !canContinuePage1) return;
    setP1Loading(true);
    try {
      const s1 = {
        displayName, username, bio, bannerPreset,
        avatarUrl: avatar.url,
        avatarType: avatar.type,
        avatarInitials: avatar.initials,
        avatarColor: avatar.color,
      };
      await saveStep1(user.id, s1);
      setStep1(s1);
      await saveStep2(user.id, { platforms, skillLevel: skill });
      setStep2({ platforms, skillLevel: skill });
      setPage(2);
      window.scrollTo({ top: 0 });
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
    } finally {
      setP1Loading(false);
    }
  }

  async function handleComplete() {
    if (!user || !canComplete || awarded.current) return;
    setCompleting(true);
    try {
      const favGames = selectedIds
        .map(id => gameCache[id])
        .filter(Boolean)
        .map(g => ({ id: g.id, name: g.name, coverUrl: g.coverUrl }));
      await saveStep3(user.id, { favGameIds: selectedIds, favGenres: genres, favGames });
      setStep3({ favGameIds: selectedIds, favGenres: genres });
      const xp = await completeOnboarding(user.id);
      awarded.current = true;
      enableXP();
      if (xp > 0) {
        addXP(xp);
        window.dispatchEvent(new CustomEvent('xp-gained', {
          detail: { awarded: xp, label: 'Profile Complete!', tier_up: false },
        }));
      }
      clear();
      navigate('/');
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to complete onboarding. Please try again.');
      setCompleting(false);
    }
  }

  const baseList = searchResults ?? POPULAR_GAMES;
  const selectedGames = selectedIds.map(id => gameCache[id]).filter(Boolean) as GameOption[];
  const unselectedBase = baseList.filter(g => !selectedIds.includes(g.id));
  const displayGames = [...selectedGames, ...unselectedBase];
  const bannerLabel = BANNERS.find(b => b.id === bannerPreset)?.label ?? 'Ember Dawn';
  const platformLabel = platforms.slice(0, 2).join(' · ') || '—';

  const usernameIcon = usernameStatus === 'checking' ? '⏳'
    : usernameStatus === 'available' ? '✓'
    : usernameStatus === 'taken' ? '✗' : '';
  const usernameColor = usernameStatus === 'available' ? 'text-emerald-400'
    : usernameStatus === 'taken' ? 'text-red-400' : 'text-white/30';

  // ── Sidebar ─────────────────────────────────────────────────────────────

  const sidebar = (
    <aside
      className="flex flex-col gap-3 p-5 flex-shrink-0 overflow-y-auto"
      style={{ background: '#1a1a35', borderRight: '0.5px solid rgba(255,255,255,0.07)', width: 220 }}
    >
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/60 mb-1">Why join?</p>

      {BENEFIT_CARDS.map(b => (
        <div
          key={b.label}
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[13px] flex-shrink-0"
                 style={{ background: b.iconBg }}>
              {b.icon}
            </div>
            <span className="text-[12px] font-medium text-white">{b.label}</span>
          </div>
          <p className="text-[10px] text-white/65 leading-[1.4]">{b.desc}</p>
          {b.xp && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-[5px] text-[9px] font-semibold text-[#FCD34D]"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '0.5px solid rgba(251,191,36,0.3)' }}>
              {b.xp}
            </span>
          )}
        </div>
      ))}

      {/* Progress */}
      <div className="mt-auto rounded-[9px] p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <p className="text-[10px] text-white/60 mb-2">Your progress</p>
        <div className="flex flex-col gap-1.5">
          {[
            { n: 1, label: 'Identity' },
            { n: 2, label: 'Platforms' },
            { n: 3, label: 'Your Games' },
            { n: 4, label: 'All done' },
          ].map(step => {
            const done    = page === 2 && step.n <= 2;
            const current = (page === 1 && step.n <= 2) || (page === 2 && step.n >= 3);
            const todo    = page === 1 && step.n >= 3;
            return (
              <div key={step.n} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 ${
                  done ? 'bg-[#534AB7] text-white' :
                  current ? 'bg-[#534AB7] text-white ring-[3px] ring-[#534AB7]/25' :
                  'bg-white/8 text-white/35'
                }`}>
                  {done ? <Check className="w-2.5 h-2.5" /> : step.n}
                </div>
                <span className={`text-[11px] ${done || current ? 'text-white/60' : 'text-white/30'} ${current ? 'font-medium !text-white' : ''}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );

  const inputCls = "min-h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none placeholder:text-white/22 focus:border-[#534AB7] sm:min-h-0 sm:text-[12px]";

  // ── Step cards ───────────────────────────────────────────────────────────

  const step1Content = (
    <>
      {/* Avatar */}
      <div>
        <FieldLabel>Profile photo</FieldLabel>
        <div className="[&_button]:!border-white/15 [&_button]:!text-white/55 [&_button]:!bg-white/5 [&_button:hover]:!border-[#534AB7]">
          <AvatarPicker
            username={username}
            userId={user?.id ?? ''}
            value={avatar}
            onChange={setAvatar}
          />
        </div>
      </div>

      {/* Banner picker */}
      <div>
        <FieldLabel>Profile banner — choose one</FieldLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {BANNERS.map(b => (
            <button
              key={b.id}
              onClick={() => setBannerPreset(b.id)}
              title={b.label}
              className="relative h-11 overflow-hidden rounded-lg border-2 transition-all sm:h-10"
              style={{
                background: BANNER_GRADIENTS[b.id],
                borderColor: bannerPreset === b.id ? '#534AB7' : 'transparent',
                boxShadow: bannerPreset === b.id ? '0 0 0 1px rgba(83,74,183,0.4)' : undefined,
              }}
            >
              {bannerPreset === b.id && (
                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-[#534AB7] flex items-center justify-center">
                  <Check className="w-2 h-2 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/25 mt-1">Unlock more banners through Battle Pass rewards</p>
      </div>

      {/* Display name */}
      <div>
        <FieldLabel>Display name <span className="text-white/20 normal-case tracking-normal">*</span></FieldLabel>
        <input
          className={inputCls}
          placeholder="GamerPulse99"
          value={displayName}
          maxLength={30}
          onChange={e => setDisplayName(e.target.value)}
        />
      </div>

      {/* Username */}
      <div>
        <FieldLabel>Username <span className="text-white/20 normal-case tracking-normal">*</span></FieldLabel>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[12px]">@</span>
          <input
            className={`${inputCls} pl-6 pr-7`}
            placeholder="gamerpulse99"
            value={username}
            maxLength={20}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          />
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium ${usernameColor}`}>
            {usernameIcon}
          </span>
        </div>
        {usernameStatus === 'taken' && (
          <p className="text-[10px] text-red-400 mt-1">Username taken</p>
        )}
      </div>

      {/* Bio */}
      <div>
        <FieldLabel>Bio <span className="text-white/20 normal-case tracking-normal">(optional)</span></FieldLabel>
        <textarea
          className={`${inputCls} h-20 resize-none sm:h-14`}
          placeholder="Tell other gamers about yourself..."
          value={bio}
          maxLength={120}
          onChange={e => setBio(e.target.value)}
        />
        <p className="text-[9px] text-white/20 text-right mt-0.5">{bio.length} / 120</p>
      </div>
    </>
  );

  const step2Content = (
    <>
      <div>
        <FieldLabel>Select all that apply</FieldLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {PLATFORMS.map(p => {
            const sel = platforms.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-all sm:gap-2 sm:px-2.5"
                style={{
                  background: sel ? 'rgba(83,74,183,0.15)' : 'rgba(255,255,255,0.04)',
                  border: sel ? '0.5px solid rgba(83,74,183,0.4)' : '0.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <span className="text-sm w-6 text-center flex-shrink-0">{p.icon}</span>
                <span className={`text-[11px] font-medium flex-1 ${sel ? 'text-[#a5b4fc]' : 'text-white/60'}`}>{p.label}</span>
                {sel && (
                  <div className="w-3.5 h-3.5 rounded-full bg-[#534AB7] flex items-center justify-center flex-shrink-0">
                    <Check className="w-2 h-2 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Skill level</FieldLabel>
        <div className="flex gap-1.5 mt-1">
          {SKILL_LEVELS.map(s => (
            <button
              key={s}
              onClick={() => setSkill(s)}
              className="min-h-11 flex-1 rounded-[7px] py-1.5 text-[10px] transition-all sm:min-h-0"
              style={{
                background: skill === s ? 'rgba(83,74,183,0.18)' : 'rgba(255,255,255,0.04)',
                border: skill === s ? '0.5px solid #534AB7' : '0.5px solid rgba(255,255,255,0.08)',
                color: skill === s ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                fontWeight: skill === s ? 500 : 400,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[9px] px-3 py-2.5 mt-auto" style={{
        background: 'rgba(83,74,183,0.1)',
        border: '0.5px solid rgba(83,74,183,0.2)',
      }}>
        <p className="text-[11px] text-[#a5b4fc] font-medium mb-0.5">⭐ You're earning XP right now</p>
        <p className="text-[10px] text-white/35 leading-[1.4]">
          Completing your profile earns +50 XP above your daily cap — awarded the moment you finish Step 4.
        </p>
      </div>
    </>
  );

  const step3Content = (
    <>
      <div>
        <FieldLabel>
          Favourite games{' '}
          <span className={`normal-case tracking-normal ${selectedIds.length < 3 ? 'text-red-400' : 'text-[#534AB7]'}`}>
            * min 3 · {selectedIds.length} selected
          </span>
        </FieldLabel>
        <div className="[&_input]:!min-h-11 [&_input]:!border-white/10 [&_input]:!bg-white/5 [&_input]:!text-base [&_input]:!text-white [&_input]:!placeholder-white/22 [&_input:focus]:!border-[#534AB7] [&_svg]:!text-white/30 sm:[&_input]:!text-sm">
          <GameSearchInput onResults={handleSearchResults} onClear={() => setSearchResults(null)} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {displayGames.map(g => {
            const sel = selectedIds.includes(g.id);
            const emoji = GAME_EMOJIS[g.id] ?? '🎮';
            return (
              <button
                key={g.id}
                onClick={() => toggleGame(g.id)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] transition-all sm:min-h-0"
                style={{
                  background: sel ? 'rgba(83,74,183,0.18)' : 'rgba(255,255,255,0.04)',
                  border: sel ? '0.5px solid #534AB7' : '0.5px solid rgba(255,255,255,0.08)',
                  color: sel ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                  fontWeight: sel ? 500 : 400,
                }}
              >
                <span>{emoji}</span> {g.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Favourite genres <span className="text-white/20 normal-case tracking-normal">(optional)</span></FieldLabel>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {GENRES.map(g => {
            const sel = genres.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className="inline-flex min-h-9 items-center rounded-full px-2.5 py-1 text-[10px] transition-all sm:min-h-0"
                style={{
                  background: sel ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.04)',
                  border: sel ? '0.5px solid rgba(13,148,136,0.4)' : '0.5px solid rgba(255,255,255,0.08)',
                  color: sel ? '#2DD4BF' : 'rgba(255,255,255,0.4)',
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {selectedIds.length < 3 && (
        <p className="text-[10px] text-white/22">Select at least 3 games to continue</p>
      )}
    </>
  );

  const step4Content = (
    <>
      {/* XP box */}
      <div className="rounded-[10px] p-3.5 text-center" style={{ background: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.25)' }}>
        <p className="text-2xl font-bold text-[#FCD34D]">+50 XP</p>
        <p className="text-[10px] text-white/35 mt-0.5">Profile completion bonus — credited above daily cap</p>
      </div>

      {/* Confirmation rows */}
      <div className="flex flex-col gap-1.5">
        {[
          { icon: '👤', label: 'Identity',        val: displayName || state.step1?.displayName || '—' },
          { icon: '🖼️', label: 'Banner',          val: bannerLabel },
          { icon: '🎮', label: 'Platforms',        val: platformLabel },
          { icon: '⚔️', label: 'Favourite games', val: `${selectedIds.length} selected`, color: selectedIds.length >= 3 ? '#a5b4fc' : 'rgba(255,255,255,0.4)' },
          { icon: '📰', label: 'Feed personalised', val: 'Ready ✓', color: '#10b981' },
          { icon: '🏅', label: 'Season 1 status',  val: 'Founder ✓', color: '#FCD34D' },
        ].map(row => (
          <div key={row.label} className="flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-sm w-5 text-center flex-shrink-0">{row.icon}</span>
            <span className="min-w-0 flex-1 text-[11px] text-white/40">{row.label}</span>
            <span className="max-w-[48%] truncate text-right text-[11px] font-medium" style={{ color: row.color ?? '#a5b4fc' }}>{row.val}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleComplete}
        disabled={!canComplete || completing}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[#534AB7] text-[13px] font-semibold text-white transition-colors hover:bg-[#3C3489] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {completing ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Complete profile &amp; enter Talus
          </>
        )}
      </button>
      <p className="text-center text-[9px] text-white/20">Free forever · No credit card required</p>
    </>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden" style={{ background: '#0d0d1a', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
      {/* Nav */}
      <nav className="flex min-h-[54px] flex-shrink-0 items-center justify-between gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6"
           style={{ background: '#12122a', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <TalusLogo size={34} />
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-medium text-[#a5b4fc] sm:px-3 sm:text-[10px]"
              style={{ background: 'rgba(83,74,183,0.2)', border: '0.5px solid rgba(83,74,183,0.4)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Season 1 is live
        </span>
      </nav>

      {/* Page tabs */}
      <div className="flex flex-shrink-0 overflow-x-auto px-2 sm:px-6"
           style={{ background: '#12122a', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        {([1, 2] as const).map(p => (
          <button
            key={p}
            onClick={() => setPage(p)}
            type="button"
            aria-current={page === p ? 'step' : undefined}
            className="min-h-11 min-w-0 flex-1 whitespace-nowrap border-b-2 px-2 py-2.5 text-[10px] transition-colors sm:min-h-0 sm:flex-none sm:px-[18px] sm:text-[11px]"
            style={{
              color: page === p ? '#fff' : 'rgba(255,255,255,0.35)',
              fontWeight: page === p ? 500 : 400,
              borderColor: page === p ? '#534AB7' : 'transparent',
            }}
          >
            <span className="sm:hidden">{p === 1 ? '1. Identity & platforms' : '2. Games & confirm'}</span>
            <span className="hidden sm:inline">{p === 1 ? 'Page 1 — Identity & Platforms' : 'Page 2 — Games & Confirm'}</span>
          </button>
        ))}
      </div>

      {/* Compact progress for phones and tablets (desktop uses the sidebar). */}
      <div className="grid grid-cols-4 gap-1 border-b border-white/5 bg-[#12122a] px-3 py-3 lg:hidden">
        {[
          { n: 1, label: 'Identity' },
          { n: 2, label: 'Platforms' },
          { n: 3, label: 'Games' },
          { n: 4, label: 'Done' },
        ].map((step, index) => {
          const done = page === 2 && step.n <= 2;
          const current = page === 1 ? step.n <= 2 : step.n >= 3;
          return (
            <div key={step.n} className="relative flex min-w-0 flex-col items-center gap-1.5">
              {index > 0 && <span className={`absolute right-1/2 top-3 h-px w-full ${done ? 'bg-[#534AB7]' : 'bg-white/10'}`} />}
              <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold ${done || current ? 'bg-[#534AB7] text-white' : 'bg-white/8 text-white/35'}`}>
                {done ? <Check className="h-3 w-3" /> : step.n}
              </span>
              <span className={`w-full truncate text-center text-[9px] ${current || done ? 'text-white/75' : 'text-white/30'}`}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Layout */}
      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <div className="hidden lg:contents">{sidebar}</div>

        <main className="flex w-full flex-1 flex-col gap-4 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:overflow-y-auto">
          <p className="px-1 text-[10px] uppercase tracking-[0.06em] text-white/30 sm:px-0 sm:text-[12px]">
            Step {page} of 2 — Page {page}
          </p>

          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            {page === 1 ? (
              <>
                <StepCard active number={1} title="Identity" sub="Your name, avatar and banner" footer={
                  <ProgBar step="Step 1 of 4" pct={25} />
                }>
                  {step1Content}
                </StepCard>

                <StepCard active number={2} title="Platforms" sub="Where you game" footer={
                  <>
                    <ProgBar step="Step 2 of 4" pct={50} />
                    <button
                      onClick={handlePage1Continue}
                      disabled={!canContinuePage1 || p1Loading}
                      className="flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[7px] bg-[#534AB7] px-4 py-2 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-[11px]"
                    >
                      {p1Loading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Continue →
                    </button>
                  </>
                }>
                  {step2Content}
                </StepCard>
              </>
            ) : (
              <>
                <StepCard active number={3} title="Your Games" sub="What you play" footer={
                  <ProgBar step="Step 3 of 4" pct={75} />
                }>
                  {step3Content}
                </StepCard>

                <StepCard active number={4} title="All done" sub="Review and activate your profile" footer={
                  <ProgBar step="Step 4 of 4 — Final" pct={100} />
                }>
                  {step4Content}
                </StepCard>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
