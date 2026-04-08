import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '@/contexts/AuthGateContext';
import { OnboardingLayout } from './OnboardingLayout';
import { GameRow } from '@/components/onboarding/GameRow';
import { GameSearchInput, GameOption } from '@/components/onboarding/GameSearchInput';
import { GenreChip } from '@/components/onboarding/GenreChip';
import { XPCallout } from '@/components/onboarding/XPCallout';
import { saveStep3 } from '@/lib/onboardingService';
import { useOnboardingState } from '@/hooks/useOnboardingState';

const POPULAR_GAMES: GameOption[] = [
  { id: 'minecraft',     name: 'Minecraft',                     genre: 'Sandbox',          coverUrl: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?w=28&h=28&fit=crop' },
  { id: 'fortnite',      name: 'Fortnite',                      genre: 'Battle Royale',    coverUrl: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?w=28&h=28&fit=crop' },
  { id: 'cod-bo6',       name: 'Call of Duty: Black Ops 6',     genre: 'FPS',              coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=28&h=28&fit=crop' },
  { id: 'valorant',      name: 'Valorant',                      genre: 'FPS / Tactical',   coverUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=28&h=28&fit=crop' },
  { id: 'lol',           name: 'League of Legends',             genre: 'MOBA',             coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=28&h=28&fit=crop' },
  { id: 'elden-ring',    name: 'Elden Ring',                    genre: 'Action RPG',       coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=28&h=28&fit=crop' },
  { id: 'gta-v',         name: 'GTA V',                         genre: 'Action Adventure', coverUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=28&h=28&fit=crop' },
  { id: 'cs2',           name: 'Counter-Strike 2',              genre: 'FPS',              coverUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=28&h=28&fit=crop' },
  { id: 'apex',          name: 'Apex Legends',                  genre: 'Battle Royale',    coverUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=28&h=28&fit=crop' },
  { id: 'roblox',        name: 'Roblox',                        genre: 'Platform / Sandbox', coverUrl: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=28&h=28&fit=crop' },
  { id: 'zelda-totk',    name: 'Zelda: Tears of the Kingdom',   genre: 'Action Adventure', coverUrl: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=28&h=28&fit=crop' },
  { id: 'hogwarts',      name: 'Hogwarts Legacy',               genre: 'Action RPG',       coverUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=28&h=28&fit=crop' },
  { id: 'ea-fc',         name: 'EA Sports FC',                  genre: 'Sports',           coverUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=28&h=28&fit=crop' },
  { id: 'rocket-league', name: 'Rocket League',                 genre: 'Sports',           coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=28&h=28&fit=crop' },
  { id: 'overwatch2',    name: 'Overwatch 2',                   genre: 'FPS / Hero Shooter', coverUrl: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=28&h=28&fit=crop' },
  { id: 'dota2',         name: 'Dota 2',                        genre: 'MOBA',             coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=28&h=28&fit=crop' },
  { id: 'among-us',      name: 'Among Us',                      genre: 'Social Deduction', coverUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=28&h=28&fit=crop' },
  { id: 'genshin',       name: 'Genshin Impact',                genre: 'Action RPG / Gacha', coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=28&h=28&fit=crop' },
  { id: 'cyberpunk',     name: 'Cyberpunk 2077',                genre: 'Action RPG',       coverUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=28&h=28&fit=crop' },
  { id: 'stardew',       name: 'Stardew Valley',                genre: 'Simulation / RPG', coverUrl: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=28&h=28&fit=crop' },
];

const GENRES = [
  { value: 'rpg',      label: 'RPG' },
  { value: 'fps',      label: 'FPS' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'sports',   label: 'Sports' },
  { value: 'horror',   label: 'Horror' },
  { value: 'indie',    label: 'Indie' },
  { value: 'moba',     label: 'MOBA' },
  { value: 'sim',      label: 'Sim' },
];

export default function Step3Games() {
  const { user } = useAuthGate();
  const navigate = useNavigate();
  const { state, setStep3 } = useOnboardingState();

  const [selectedIds, setSelectedIds] = useState<string[]>(state.step3?.favGameIds ?? []);
  const [genres, setGenres]           = useState<string[]>(state.step3?.favGenres ?? []);
  const [searchResults, setSearchResults] = useState<GameOption[] | null>(null);
  const [loading, setLoading] = useState(false);

  const displayList = searchResults ?? POPULAR_GAMES;
  const selectedGames = POPULAR_GAMES.filter(g => selectedIds.includes(g.id));
  const unselectedDisplay = displayList.filter(g => !selectedIds.includes(g.id));

  function toggleGame(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleGenre(v: string) {
    setGenres(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  async function handleContinue() {
    if (!user || selectedIds.length < 3) return;
    setLoading(true);
    try {
      await saveStep3(user.id, { favGameIds: selectedIds, favGenres: genres });
      setStep3({ favGameIds: selectedIds, favGenres: genres });
      navigate('/onboarding/step-4');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingLayout
      step={3}
      title="What do you play?"
      subtitle="Pick your favourite games. This powers your personalised feed."
      showBack
      continueDisabled={selectedIds.length < 3}
      continueLoading={loading}
      onContinue={handleContinue}
    >
      <div className="flex flex-col gap-6">
        <p className={`text-sm font-medium ${selectedIds.length < 3 ? 'text-red-500' : 'text-[#534AB7]'}`}>
          {selectedIds.length} selected · 3 minimum
        </p>

        <GameSearchInput
          onResults={setSearchResults}
          onClear={() => setSearchResults(null)}
        />

        <div className="flex flex-col overflow-y-auto max-h-[200px] md:max-h-[280px] gap-1 pr-1">
          {selectedGames.map(g => (
            <GameRow key={g.id} {...g} selected onToggle={toggleGame} />
          ))}
          {unselectedDisplay.map(g => (
            <GameRow key={g.id} {...g} selected={false} onToggle={toggleGame} />
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Favourite genres <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <GenreChip
                key={g.value}
                value={g.value}
                label={g.label}
                selected={genres.includes(g.value)}
                onToggle={toggleGenre}
              />
            ))}
          </div>
        </div>

        <XPCallout />
      </div>
    </OnboardingLayout>
  );
}
