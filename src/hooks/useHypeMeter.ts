import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchGameList } from "@/lib/rawg";

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

// Curated upcoming titles so the meter isn't empty before votes exist.
// Real vote counts from hype_votes are layered on top; no fake numbers.
const SEED_GAMES: Omit<HypeGame, "rank" | "hypePercent" | "weeklyTrend" | "voteCount" | "userHyped">[] = [
  { id: "gta6", igdbId: "gta6", name: "GTA 6", coverEmoji: "🌴", coverColor: "#1a0a0a", coverUrl: null, releaseDate: "Nov 2026" },
  { id: "the-elder-scrolls-vi", igdbId: "es6", name: "The Elder Scrolls VI", coverEmoji: "⚔️", coverColor: "#0a1015", coverUrl: null, releaseDate: "TBA" },
  { id: "the-witcher-4", igdbId: "witcher4", name: "The Witcher 4", coverEmoji: "🐺", coverColor: "#101018", coverUrl: null, releaseDate: "TBA" },
  { id: "marvels-wolverine", igdbId: "wolverine", name: "Marvel's Wolverine", coverEmoji: "🗡️", coverColor: "#150505", coverUrl: null, releaseDate: "2026" },
  { id: "judas", igdbId: "judas", name: "Judas", coverEmoji: "🚀", coverColor: "#2e1a1a", coverUrl: null, releaseDate: "TBA" },
  { id: "call-of-duty-2026", igdbId: "cod26", name: "Call of Duty 2026", coverEmoji: "🎯", coverColor: "#0f0800", coverUrl: null, releaseDate: "Holiday 2026" },
];

const HYPE_QUERY_KEY = ["hype", "top"];

interface HypeRow {
  game_id: string;
  game_name: string;
  votes: number;
  recent_votes: number;
}

async function fetchHypeGames(): Promise<HypeGame[]> {
  // supabase client types don't include the new RPC/table yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: rows }, { data: auth }] = await Promise.all([
    sb.rpc("get_hype_leaderboard"),
    supabase.auth.getUser(),
  ]);

  let myVotes = new Set<string>();
  if (auth?.user) {
    const { data: mine } = await sb
      .from("hype_votes")
      .select("game_id")
      .eq("user_id", auth.user.id);
    myVotes = new Set((mine ?? []).map((r: { game_id: string }) => r.game_id));
  }

  const votesById = new Map<string, HypeRow>(
    ((rows ?? []) as HypeRow[]).map((r) => [r.game_id, r])
  );

  // Seeds first, then any voted-in games that aren't seeds.
  const base = SEED_GAMES.map((g) => ({ ...g }));
  for (const row of votesById.values()) {
    if (!base.some((g) => g.id === row.game_id)) {
      base.push({
        id: row.game_id,
        igdbId: row.game_id,
        name: row.game_name,
        coverEmoji: "🎮",
        coverColor: "#1a1a2e",
        coverUrl: null,
        releaseDate: "TBA",
      });
    }
  }

  const counts = base.map((g) => votesById.get(g.id)?.votes ?? 0);
  const maxVotes = Math.max(...counts, 0);

  return base
    .map((g) => {
      const row = votesById.get(g.id);
      const votes = row?.votes ?? 0;
      const recent = row?.recent_votes ?? 0;
      return {
        ...g,
        voteCount: votes,
        hypePercent: maxVotes > 0 ? Math.round((votes / maxVotes) * 100) : 0,
        weeklyTrend: votes > 0 ? Math.round((recent / votes) * 100) : 0,
        userHyped: myVotes.has(g.id),
        rank: 0,
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount || a.name.localeCompare(b.name))
    .map((g, i) => ({ ...g, rank: i + 1 }))
    .slice(0, 6);
}

export function useHypeMeter() {
  const queryClient = useQueryClient();

  const { data: topGames = [], isLoading } = useQuery({
    queryKey: HYPE_QUERY_KEY,
    queryFn: fetchHypeGames,
    staleTime: 60 * 1000,
  });

  const voteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const game = topGames.find((g) => g.id === id);
      const wasHyped = game?.userHyped ?? false;

      if (wasHyped) {
        const { error } = await sb
          .from("hype_votes")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("game_id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("hype_votes").insert({
          user_id: auth.user.id,
          game_id: id,
          game_name: game?.name ?? id,
        });
        if (error) throw error;
      }
      return !wasHyped; // true if we just hyped it
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HYPE_QUERY_KEY });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (game: SearchResult) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { error } = await sb.from("hype_votes").upsert(
        { user_id: auth.user.id, game_id: game.igdbId, game_name: game.name },
        { onConflict: "user_id,game_id" }
      );
      if (error) throw error;
      return game;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HYPE_QUERY_KEY });
    },
  });

  const searchGames = async (query: string): Promise<SearchResult[]> => {
    const q = query.trim();
    if (q.length < 2) return [];

    const inMeter = new Map(topGames.map((g) => [g.id, g]));

    try {
      const res = await fetchGameList({ search: q, page_size: 5 });
      return (res.results ?? []).slice(0, 5).map((r) => {
        const existing = inMeter.get(r.slug);
        return {
          igdbId: r.slug,
          name: r.name,
          coverEmoji: "🎮",
          coverColor: "#1a1a2e",
          coverUrl: r.background_image,
          releaseDate: r.released ?? "TBA",
          isInHypeMeter: !!existing,
          hypePercent: existing?.hypePercent ?? null,
          userHyped: existing?.userHyped ?? false,
        };
      });
    } catch {
      return [];
    }
  };

  return {
    topGames,
    isLoading,
    toggleVote: voteMutation.mutateAsync,
    isVoting: voteMutation.isPending,
    submitGame: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    searchGames,
  };
}
