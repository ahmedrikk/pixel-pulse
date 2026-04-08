import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface GameOption {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
}

interface GameSearchInputProps {
  onResults: (games: GameOption[]) => void;
  onClear: () => void;
}

export function GameSearchInput({ onResults, onClear }: GameSearchInputProps) {
  const [query, setQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { onClear(); return; }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('games')
        .select('id, name, genres, cover_image')
        .ilike('name', `%${query}%`)
        .limit(10);

      const results: GameOption[] = (data ?? []).map(g => ({
        id: g.id,
        name: g.name,
        genre: g.genres?.[0] ?? 'Game',
        coverUrl: g.cover_image ?? '',
      }));
      onResults(results);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query, onResults, onClear]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search games…"
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#534AB7]"
      />
    </div>
  );
}
