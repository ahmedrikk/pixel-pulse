import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMonthBounds } from "@/lib/gameCalendar";
import { normalisePlatforms, type RawgListResponse } from "@/lib/rawg";

export interface CalendarGame {
  id: string;
  slug: string;
  name: string;
  coverImage: string | null;
  platforms: string[];
  genres: string[];
  releaseDate: string;
  rawgRating: number;
  metacriticScore: number | null;
  ourRating: number;
  reviewCount: number;
}

function mapRawgGame(game: RawgListResponse["results"][number]): CalendarGame {
  return {
    id: game.slug,
    slug: game.slug,
    name: game.name,
    coverImage: game.background_image,
    platforms: normalisePlatforms(game.platforms),
    genres: game.genres?.map((genre) => genre.slug) ?? [],
    releaseDate: game.released!,
    rawgRating: Math.round(Number(game.rating ?? 0) * 10) / 10,
    metacriticScore: game.metacritic,
    ourRating: 0,
    reviewCount: 0,
  };
}

async function getCachedGameCalendar(month: Date): Promise<CalendarGame[]> {
  const { start, end } = getMonthBounds(month);
  const { data, error } = await supabase
    .from("games")
    .select("id, slug, name, cover_image, platforms, genres, release_date, rawg_rating, metacritic_score, our_rating, review_count")
    .gte("release_date", start)
    .lte("release_date", end)
    .order("release_date", { ascending: true })
    .order("rawg_rating", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw error;

  return (data ?? []).filter((game) => game.release_date).map((game) => ({
      id: game.id,
      slug: game.slug,
      name: game.name,
      coverImage: game.cover_image,
      platforms: game.platforms ?? [],
      genres: game.genres ?? [],
      releaseDate: game.release_date,
      rawgRating: Number(game.rawg_rating ?? 0),
      metacriticScore: game.metacritic_score,
      ourRating: Number(game.our_rating ?? 0),
      reviewCount: Number(game.review_count ?? 0),
    })).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || b.rawgRating - a.rawgRating);
}

async function refreshGameCalendar(month: Date): Promise<CalendarGame[]> {
  const { start, end } = getMonthBounds(month);
  const response = await fetch(`/api/game-calendar?startDate=${start}&endDate=${end}`);
  if (!response.ok) throw new Error(`Calendar endpoint returned ${response.status}`);
  const payload = await response.json() as RawgListResponse;
  const rawGames = payload.results.filter((game) => game.slug && game.name && game.released);
  const refreshed = rawGames.map(mapRawgGame);

  // Update only canonical metadata. Descriptions, reviews, free offers, and
  // patches remain untouched on the shared Game record.
  if (rawGames.length > 0) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("games").upsert(rawGames.map((game) => ({
      id: game.slug,
      slug: game.slug,
      name: game.name,
      cover_image: game.background_image,
      rawg_rating: Math.round(Number(game.rating ?? 0) * 10) / 10,
      metacritic_score: game.metacritic,
      genres: game.genres?.map((genre) => genre.slug) ?? [],
      platforms: normalisePlatforms(game.platforms),
      release_date: game.released,
      trending: Number(game.added ?? 0) >= 500,
      expires_at: expiresAt,
    })), { onConflict: "id" });
    if (error) console.warn("Game calendar cache update was unavailable", error);
  }

  return refreshed;
}

function mergeCalendarGames(cached: CalendarGame[], refreshed: CalendarGame[]): CalendarGame[] {
  const merged = new Map(cached.map((game) => [game.id, game]));
  for (const game of refreshed) {
    const canonical = merged.get(game.id);
    merged.set(game.id, canonical ? {
      ...game,
      ourRating: canonical.ourRating,
      reviewCount: canonical.reviewCount,
    } : game);
  }
  return [...merged.values()].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || b.rawgRating - a.rawgRating);
}

export function useGameCalendar(month: Date) {
  const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
  const queryClient = useQueryClient();
  const calendarKey = ["games", "calendar", monthKey] as const;
  const cachedQuery = useQuery({
    queryKey: calendarKey,
    queryFn: () => getCachedGameCalendar(month),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
  const refreshQuery = useQuery({
    queryKey: ["games", "calendar-refresh", monthKey],
    queryFn: async () => {
      const refreshed = await refreshGameCalendar(month);
      const cached = queryClient.getQueryData<CalendarGame[]>(calendarKey) ?? [];
      const merged = mergeCalendarGames(cached, refreshed);
      queryClient.setQueryData(calendarKey, merged);
      return merged;
    },
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const cachedGames = cachedQuery.data ?? [];
  const games = refreshQuery.data ?? cachedGames;
  const hasImmediateCache = cachedGames.length > 0;
  const combinedError = games.length > 0
    ? null
    : cachedQuery.error ?? refreshQuery.error;

  return {
    ...cachedQuery,
    data: games,
    error: combinedError,
    isLoading: cachedQuery.isLoading || (!hasImmediateCache && refreshQuery.isLoading),
    isFetching: cachedQuery.isFetching || refreshQuery.isFetching,
    refetch: async () => {
      const [cachedResult, refreshResult] = await Promise.all([
        cachedQuery.refetch(),
        refreshQuery.refetch(),
      ]);
      return refreshResult.data ?? cachedResult.data;
    },
  };
}
