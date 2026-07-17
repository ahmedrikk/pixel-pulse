import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/contexts/AuthGateContext";

export type HLStatCategory =
  | "metacritic_score" | "steam_player_count" | "esports_prize_pool"
  | "release_year" | "twitch_hours_watched" | "metacritic_user_score";

export interface HLItem {
  name: string;
  coverEmoji: string;
  coverColor: string;
  value: number | null;
  revealed: boolean;
}

export interface HLRound {
  id: string;
  category: HLStatCategory;
  categoryLabel: string;
  itemA: HLItem;
  itemB: HLItem;
  runCount: number;
  bestRun: number;
  totalGuesses: number;
}

export interface HLGuessResult {
  correct: boolean;
  actualValue: number;
  newRoundId: string | null;
  runCount: number;
  bestRun: number;
}

export interface HLLeaderboardEntry {
  userId: string;
  username: string;
  bestRun: number;
}

export interface SentimentQuestion {
  id: string;
  question: string;
  gameTag: string | null;
  yesCount: number;
  noCount: number;
  yesPercent: number;
  noPercent: number;
  userVote: "yes" | "no" | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export interface HistoryFact {
  id: string;
  date: string;
  year: number;
  headline: string;
  description: string;
  gameTag: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
}

const sb = supabase as unknown as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => ReturnType<typeof supabase.from>;
};

function normalizeRound(value: unknown): HLRound {
  const round = value as HLRound;
  return {
    ...round,
    itemA: { ...round.itemA, value: Number(round.itemA.value) },
    itemB: { ...round.itemB, value: round.itemB.value == null ? null : Number(round.itemB.value) },
    runCount: Number(round.runCount ?? 0),
    bestRun: Number(round.bestRun ?? 0),
    totalGuesses: Number(round.totalGuesses ?? 0),
  };
}

async function guestRound(): Promise<HLRound> {
  interface HLItemRow { id: string; category: HLStatCategory; category_label: string; name: string; cover_emoji: string; cover_color: string; value: number | string }
  // Tables are introduced by the accompanying migration and are not present in the generated client types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("hub_higher_lower_items")
    .select("id,category,category_label,name,cover_emoji,cover_color,value")
    .eq("active", true);
  if (error || !data?.length) throw new Error(error?.message ?? "Higher or Lower is unavailable");
  const items = data as HLItemRow[];
  const categories = [...new Set(items.map((item) => item.category))];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const pool = items.filter((item) => item.category === category).sort(() => Math.random() - 0.5);
  const [a, b] = pool;
  return {
    id: `guest-${a.id}-${b.id}`,
    category,
    categoryLabel: a.category_label,
    itemA: { name: a.name, coverEmoji: a.cover_emoji, coverColor: a.cover_color, value: Number(a.value), revealed: true },
    itemB: { name: b.name, coverEmoji: b.cover_emoji, coverColor: b.cover_color, value: null, revealed: false },
    runCount: 0, bestRun: 0, totalGuesses: 0,
  };
}

export function useHigherLower() {
  const { isAuthenticated } = useAuthGate();
  const query = useQuery({
    queryKey: ["hub", "higher-lower", isAuthenticated ? "member" : "guest"],
    queryFn: async () => {
      if (!isAuthenticated) return guestRound();
      const { data, error } = await sb.rpc("hub_higher_lower_current");
      if (error) throw new Error(error.message);
      return normalizeRound(data);
    },
    staleTime: 60_000,
  });
  const guessMutation = useMutation({
    mutationFn: async ({ roundId, guess }: { roundId: string; guess: "higher" | "lower" }) => {
      const { data, error } = await sb.rpc("hub_higher_lower_guess", { p_round_id: roundId, p_guess: guess });
      if (error) throw new Error(error.message);
      return data as HLGuessResult;
    },
  });
  return { round: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch, guess: guessMutation.mutateAsync, isGuessing: guessMutation.isPending };
}

export function useHigherLowerLeaderboard(enabled = false) {
  return useQuery({
    queryKey: ["hub", "higher-lower", "leaderboard"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("hub_higher_lower_leaderboard");
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<{ user_id: string; username: string; best_run: number }>).map((entry) => ({
        userId: entry.user_id,
        username: entry.username,
        bestRun: Number(entry.best_run),
      } satisfies HLLeaderboardEntry));
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useSentiment(limit = 5) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["hub", "sentiment", limit],
    queryFn: async () => {
      const { data, error } = await sb.rpc("hub_get_sentiment", { p_limit: limit });
      if (error) throw new Error(error.message);
      return (data ?? []) as SentimentQuestion[];
    },
    staleTime: 60_000,
  });
  const voteMutation = useMutation({
    mutationFn: async ({ id, vote }: { id: string; vote: "yes" | "no" }) => {
      const { data, error } = await sb.rpc("hub_vote_sentiment", { p_question_id: id, p_vote: vote });
      if (error) throw new Error(error.message);
      return data as SentimentQuestion;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hub", "sentiment"] }),
  });
  return { questions: query.data ?? [], isLoading: query.isLoading, error: query.error, vote: voteMutation.mutateAsync, isVoting: voteMutation.isPending };
}

export function useTodayInGamingHistory() {
  return useQuery({
    queryKey: ["hub", "history", new Date().toISOString().slice(5, 10)],
    queryFn: async () => {
      interface HistoryRow { id: string; date: string; year: number; headline: string; description: string; game_tag: string | null; image_url: string | null; source_url: string | null }
      const date = new Date().toISOString().slice(5, 10);
      // Table is introduced by the accompanying migration and is not present in generated client types yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("hub_history_facts")
        .select("id,date,year,headline,description,game_tag,image_url,source_url")
        .eq("date", date)
        .eq("published", true)
        .order("year", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as HistoryRow[]).map((fact): HistoryFact => ({
        id: fact.id, date: fact.date, year: fact.year, headline: fact.headline,
        description: fact.description, gameTag: fact.game_tag,
        imageUrl: fact.image_url, sourceUrl: fact.source_url,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}
