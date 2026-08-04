import { useQuery } from "@tanstack/react-query";
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

async function getGameCalendar(month: Date): Promise<CalendarGame[]> {
  const { start, end } = getMonthBounds(month);
  const discovered = new Map<string, CalendarGame>();

  // Fetch the month's most-followed confirmed releases, then upsert only their
  // canonical metadata fields. Descriptions, reviews, free offers, and patches
  // remain untouched on the shared Game record.
  try {
    const response = await fetch(`/api/game-calendar?startDate=${start}&endDate=${end}`);
    if (!response.ok) throw new Error(`Calendar endpoint returned ${response.status}`);
    const payload = await response.json() as RawgListResponse;
    const rawGames = payload.results
      .filter((game) => game.slug && game.name && game.released);
    for (const game of rawGames) {
      discovered.set(game.slug, {
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
      });
    }
    if (rawGames.length > 0) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: cacheError } = await supabase.from("games").upsert(rawGames.map((game) => ({
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
      if (cacheError) console.warn("Game calendar cache update was unavailable", cacheError);
    }
  } catch (syncError) {
    console.warn("RAWG calendar refresh was unavailable; showing cached releases", syncError);
  }

  const { data, error } = await supabase
    .from("games")
    .select("id, slug, name, cover_image, platforms, genres, release_date, rawg_rating, metacritic_score, our_rating, review_count")
    .gte("release_date", start)
    .lte("release_date", end)
    .order("release_date", { ascending: true })
    .order("rawg_rating", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error && discovered.size === 0) throw error;

  for (const game of data ?? []) {
    if (!game.release_date) continue;
    discovered.set(game.id, {
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
    });
  }
  return [...discovered.values()].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || b.rawgRating - a.rawgRating);
}

export function useGameCalendar(month: Date) {
  const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
  return useQuery({
    queryKey: ["games", "calendar", monthKey],
    queryFn: () => getGameCalendar(month),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}
