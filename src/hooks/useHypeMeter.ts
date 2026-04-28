import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface HypeGame {
  id: string;
  rank: number;
  igdbId: string;
  name: string;
  coverEmoji: string;
  coverColor: string;
  coverUrl: string | null;
  releaseDate: string;
  hypePercent: number;
  weeklyTrend: number;
  voteCount: number;
  userHyped: boolean;
}

export interface SearchResult {
  igdbId: string;
  name: string;
  coverEmoji: string;
  coverColor: string;
  coverUrl: string | null;
  releaseDate: string;
  isInHypeMeter: boolean;
  hypePercent: number | null;
  userHyped: boolean;
}

const INITIAL_MOCK_GAMES: HypeGame[] = [
  { id: "gta6", igdbId: "1", rank: 1, name: "GTA 6", coverEmoji: "🌴", coverColor: "#1a0a0a", coverUrl: null, releaseDate: "Fall 2025", hypePercent: 94, weeklyTrend: 12, voteCount: 487291, userHyped: false },
  { id: "es6", igdbId: "2", rank: 2, name: "Elder Scrolls VI", coverEmoji: "⚔️", coverColor: "#0a1015", coverUrl: null, releaseDate: "TBA", hypePercent: 71, weeklyTrend: 3, voteCount: 312048, userHyped: false },
  { id: "silksong", igdbId: "3", rank: 3, name: "Hollow Knight: Silksong", coverEmoji: "🐝", coverColor: "#050a0f", coverUrl: null, releaseDate: "2025", hypePercent: 58, weeklyTrend: -2, voteCount: 241807, userHyped: false },
  { id: "cod25", igdbId: "4", rank: 4, name: "Call of Duty 2025", coverEmoji: "🎯", coverColor: "#0f0800", coverUrl: null, releaseDate: "Holiday 2025", hypePercent: 42, weeklyTrend: 0, voteCount: 178334, userHyped: true },
  { id: "wolverine", igdbId: "5", rank: 5, name: "Marvel's Wolverine", coverEmoji: "🐺", coverColor: "#150505", coverUrl: null, releaseDate: "2025", hypePercent: 35, weeklyTrend: 5, voteCount: 145000, userHyped: false },
  { id: "deathstranding2", igdbId: "6", rank: 6, name: "Death Stranding 2", coverEmoji: "👶", coverColor: "#0a0c10", coverUrl: null, releaseDate: "2025", hypePercent: 28, weeklyTrend: 1, voteCount: 112000, userHyped: false },
];

const MOCK_IGDB_RESULTS: SearchResult[] = [
  { igdbId: "101", name: "Elden Ring: Nightreign", coverEmoji: "🗡️", coverColor: "#1a1a2e", coverUrl: null, releaseDate: "TBA 2025", isInHypeMeter: false, hypePercent: null, userHyped: false },
  { igdbId: "102", name: "Monster Hunter Wilds", coverEmoji: "🦖", coverColor: "#1a2e1a", coverUrl: null, releaseDate: "2025", isInHypeMeter: false, hypePercent: null, userHyped: false },
  { igdbId: "103", name: "Judas", coverEmoji: "🚀", coverColor: "#2e1a1a", coverUrl: null, releaseDate: "TBA", isInHypeMeter: false, hypePercent: null, userHyped: false },
];

let mockGamesCache = [...INITIAL_MOCK_GAMES];
let nextId = 7;

const HYPE_QUERY_KEY = ["hype", "top"];

export function useHypeMeter() {
  const queryClient = useQueryClient();

  const { data: topGames = [], isLoading } = useQuery({
    queryKey: HYPE_QUERY_KEY,
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 200));
      return [...mockGamesCache].sort((a, b) => b.voteCount - a.voteCount).map((g, i) => ({ ...g, rank: i + 1 })).slice(0, 6);
    }
  });

  const voteMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise(r => setTimeout(r, 100));
      const game = mockGamesCache.find(g => g.id === id);
      if (!game) throw new Error("Game not found");
      
      const wasHyped = game.userHyped;
      mockGamesCache = mockGamesCache.map(g => {
        if (g.id === id) {
          return {
            ...g,
            userHyped: !wasHyped,
            voteCount: wasHyped ? g.voteCount - 1 : g.voteCount + 1,
            hypePercent: wasHyped ? g.hypePercent - 1 : Math.min(g.hypePercent + 1, 100)
          };
        }
        return g;
      });
      return !wasHyped; // true if we just hyped it
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HYPE_QUERY_KEY });
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (game: SearchResult) => {
      await new Promise(r => setTimeout(r, 500));
      
      const newGame: HypeGame = {
        id: `custom-${nextId++}`,
        igdbId: game.igdbId,
        rank: mockGamesCache.length + 1,
        name: game.name,
        coverEmoji: game.coverEmoji,
        coverColor: game.coverColor,
        coverUrl: game.coverUrl,
        releaseDate: game.releaseDate,
        hypePercent: 10, // Start with some hype
        weeklyTrend: 100, // New!
        voteCount: 1,
        userHyped: true
      };
      
      mockGamesCache.push(newGame);
      return newGame;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HYPE_QUERY_KEY });
    }
  });

  const searchGames = async (query: string): Promise<SearchResult[]> => {
    await new Promise(r => setTimeout(r, 300));
    const q = query.toLowerCase();
    
    // Search local DB first
    const localMatches = mockGamesCache.filter(g => g.name.toLowerCase().includes(q)).map(g => ({
      igdbId: g.igdbId,
      name: g.name,
      coverEmoji: g.coverEmoji,
      coverColor: g.coverColor,
      coverUrl: g.coverUrl,
      releaseDate: g.releaseDate,
      isInHypeMeter: true,
      hypePercent: g.hypePercent,
      userHyped: g.userHyped
    }));
    
    // Search "IGDB"
    const igdbMatches = MOCK_IGDB_RESULTS.filter(g => g.name.toLowerCase().includes(q));
    
    return [...localMatches, ...igdbMatches].slice(0, 5);
  };

  return {
    topGames,
    isLoading,
    toggleVote: voteMutation.mutateAsync,
    isVoting: voteMutation.isPending,
    submitGame: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    searchGames
  };
}
