import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useHypeMeter, type SearchResult } from "@/hooks/useHypeMeter";
import { useAuthGate } from "@/contexts/AuthGateContext";

interface HypeSearchProps {
  onSelectGame: (game: SearchResult) => void;
  onSubmitNewGame: (game: SearchResult) => void;
}

export function HypeSearch({ onSelectGame, onSubmitNewGame }: HypeSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { searchGames } = useHypeMeter();
  const { isAuthenticated, openAuthModal } = useAuthGate();

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);
    
    searchGames(debouncedQuery).then(data => {
      if (isMounted) {
        setResults(data);
        setIsOpen(true);
        setIsSearching(false);
      }
    });

    return () => { isMounted = false; };
  }, [debouncedQuery, searchGames]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (game: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    if (game.isInHypeMeter) {
      onSelectGame(game);
    } else {
      if (!isAuthenticated) {
        openAuthModal("hub_hype" as never);
        return;
      }
      onSubmitNewGame(game);
    }
  };

  const handleCustomSubmit = () => {
    if (!isAuthenticated) {
      openAuthModal("hub_hype" as never);
      return;
    }
    setIsOpen(false);
    onSubmitNewGame({
      igdbId: `custom-${Date.now()}`,
      name: query,
      coverEmoji: "🎮",
      coverColor: "#1a1a2e",
      coverUrl: null,
      releaseDate: "TBA",
      isInHypeMeter: false,
      hypePercent: null,
      userHyped: false
    });
    setQuery("");
  };

  return (
    <div className="relative mb-[14px]" ref={dropdownRef}>
      <div className="flex items-center gap-2 bg-secondary border-[0.5px] border-border rounded-[9px] px-3 py-[9px] transition-colors focus-within:border-[#534AB7] focus-within:bg-background">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Search for a game to hype..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          className="bg-transparent border-none outline-none text-xs text-foreground w-full placeholder:text-muted-foreground"
        />
        {isSearching && (
          <div className="w-3 h-3 rounded-full border-2 border-[#534AB7] border-t-transparent animate-spin" />
        )}
      </div>

      {isOpen && (query.trim().length > 0) && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-background border-[0.5px] border-border/80 rounded-[10px] overflow-hidden z-50 shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
          {results.length > 0 ? (
            results.map((game) => (
              <div
                key={game.igdbId}
                onClick={() => handleSelect(game)}
                className="flex items-center gap-2.5 p-[10px_13px] border-b-[0.5px] border-border/40 cursor-pointer transition-colors hover:bg-secondary last:border-b-0"
              >
                <div 
                  className="w-8 h-8 rounded-[7px] flex-shrink-0 flex items-center justify-center text-sm" 
                  style={{ backgroundColor: game.coverColor }}
                >
                  {game.coverEmoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                    {game.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {game.releaseDate}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {game.isInHypeMeter ? (
                    <>
                      <div className="text-[9px] text-[#16A34A] mb-0.5">In hype ✓</div>
                      <div className="text-[11px] font-medium text-[#534AB7]">{game.hypePercent}% hyped</div>
                    </>
                  ) : (
                    <div className="text-[10px] font-medium text-[#534AB7]">+ Submit</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No exact matches found.
            </div>
          )}
          
          {/* Always show submit option at bottom if they typed something */}
          {!results.some(r => r.name.toLowerCase() === query.toLowerCase()) && (
            <div 
              onClick={handleCustomSubmit}
              className="flex items-center gap-2 p-[10px_13px] cursor-pointer text-xs text-[#534AB7] font-medium hover:bg-[#EEEDFE]"
            >
              + Submit "{query}" →
            </div>
          )}
        </div>
      )}
    </div>
  );
}
