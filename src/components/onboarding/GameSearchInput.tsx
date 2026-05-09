import { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { fetchGameList } from '@/lib/rawg';

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
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setLoading(false);
      onClear();
      return;
    }

    clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      try {
        const data = await fetchGameList({ search: trimmed, page_size: 12, ordering: '-rating' });
        if (reqId !== reqIdRef.current) return; // stale response — ignore
        const results: GameOption[] = (data.results ?? []).map(g => ({
          id: String(g.id),
          name: g.name,
          genre: g.genres?.[0]?.name ?? 'Game',
          coverUrl: g.background_image ?? '',
        }));
        onResults(results);
      } catch (err) {
        console.error('RAWG search failed:', err);
        onResults([]);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timerRef.current);
  }, [query, onResults, onClear]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search games (powered by RAWG)…"
        className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#534AB7]"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#534AB7]" />}
    </div>
  );
}
