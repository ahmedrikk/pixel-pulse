// src/hooks/useGameCatalog.ts
import { useQuery } from "@tanstack/react-query";
import { fetchGameList, normalisePlatforms, type RawgGame } from "@/lib/rawg";
import { supabase } from "@/integrations/supabase/client";
import {
  type TrendingSignals,
} from "@/lib/trending";

export interface CatalogGame extends Partial<TrendingSignals> {
  id: string;           // RAWG slug
  name: string;
  coverImage: string;
  rating: number;       // community average USER star rating (0–5)
  ratingCount: number;  // how many users have reviewed it
  userRating?: number;    // the logged-in user's own star rating, if any
  rawgRating: number;   // RAWG average rating (0–5)
  metacriticScore: number | null;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  trending: boolean;
  description: string;
}

/**
 * Average USER star rating per game (Letterboxd-style) — NOT RAWG's average.
 * There are few reviews, so we aggregate the whole table client-side.
 */
async function getUserRatingMap(): Promise<Map<string, { avg: number; count: number }>> {
  const { data } = await supabase
    .from("user_game_reviews")
    .select("game_id, star_rating");

  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of (data ?? []) as { game_id: string; star_rating: number }[]) {
    const e = acc.get(r.game_id) ?? { sum: 0, count: 0 };
    e.sum += r.star_rating;
    e.count += 1;
    acc.set(r.game_id, e);
  }

  const out = new Map<string, { avg: number; count: number }>();
  for (const [id, { sum, count }] of acc) {
    out.set(id, { avg: Math.round((sum / count) * 10) / 10, count });
  }
  return out;
}

/** Overlay real user ratings onto catalog games (0 / no count when unrated). */
function withUserRatings(
  games: CatalogGame[],
  ratings: Map<string, { avg: number; count: number }>
): CatalogGame[] {
  return games.map((g) => {
    const r = ratings.get(g.id);
    return { ...g, rating: r?.avg ?? 0, ratingCount: r?.count ?? 0 };
  });
}

function mapRawgToCatalog(g: RawgGame): CatalogGame {
  return {
    id: g.slug,
    name: g.name,
    coverImage: g.background_image ?? "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80",
    rating: 0,          // replaced with the user-review average below
    ratingCount: 0,
    rawgRating: Math.round(g.rating * 10) / 10,
    metacriticScore: g.metacritic ?? null,
    genres: g.genres?.map((gen) => gen.slug) ?? [],
    platforms: normalisePlatforms(g.platforms),
    releaseDate: g.released ?? "TBA",
    trending: g.rating >= 4.2 && (g.metacritic ?? 0) >= 80,
    description: "",  // fetched on detail page
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getCatalogGames(
  params: {
    search?: string;
    genre?: string;
    ordering?: string;
  },
  signal?: AbortSignal
): Promise<CatalogGame[]> {
  let games: CatalogGame[] = [];

  // 1. Try Supabase cache (only for unfiltered requests)
  if (!params.search && !params.genre) {
    const { data } = await supabase
      .from("games")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("rawg_rating", { ascending: false })
      .limit(40);

    if (data && data.length >= 10) {
      games = data.map((g) => ({
        id: g.id,
        name: g.name,
        coverImage: g.cover_image ?? "",
        rating: 0,        // overlaid with user-review average below
        ratingCount: 0,
        rawgRating: g.rawg_rating ?? 0,
        metacriticScore: g.metacritic_score ?? null,
        genres: g.genres ?? [],
        platforms: g.platforms ?? [],
        releaseDate: g.release_date ?? "TBA",
        trending: g.trending ?? false,
        description: g.description ?? "",
      }));
    }
  }

  // 2. Fetch from RAWG if no usable cache
  if (games.length === 0) {
    const rawgGenreMap: Record<string, string> = {
      "action-rpg": "action,role-playing-games-rpg",
      fps: "shooter",
      adventure: "adventure",
      strategy: "strategy",
      horror: "action",  // RAWG doesn't have a dedicated horror genre
      racing: "racing",
      sports: "sports",
    };

    const result = await fetchGameList(
      {
        page_size: 40,
        search: params.search,
        genres: params.genre ? rawgGenreMap[params.genre] : undefined,
        ordering: params.ordering ?? "-rating",
      },
      signal
    );

    games = result.results.map(mapRawgToCatalog);

    // 3. Write to Supabase cache (only unfiltered). Store RAWG rating as a
    //    catalog reference; the displayed rating still comes from user reviews.
    if (!params.search && !params.genre && games.length > 0) {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      await supabase.from("games").upsert(
        result.results.map((g) => ({
          id: g.slug,
          name: g.name,
          slug: g.slug,
          cover_image: g.background_image ?? "",
          rawg_rating: Math.round(g.rating * 10) / 10,
          metacritic_score: g.metacritic ?? null,
          genres: g.genres?.map((gen) => gen.slug) ?? [],
          platforms: normalisePlatforms(g.platforms),
          release_date: g.released ?? "TBA",
          trending: g.rating >= 4.2 && (g.metacritic ?? 0) >= 80,
          expires_at: expiresAt,
        })),
        { onConflict: "id" }
      );
    }
  }

  // 4. Overlay real user ratings (Letterboxd-style)
  const ratings = await getUserRatingMap();
  return withUserRatings(games, ratings);
}

export function useGameCatalog(params: {
  search?: string;
  genre?: string;
} = {}) {
  return useQuery({
    queryKey: ["games", "catalog", params.search, params.genre],
    queryFn: ({ signal }) => getCatalogGames(params, signal),
    staleTime: params.search ? 5 * 60 * 1000 : 10 * 60 * 1000,
    gcTime: params.search ? 10 * 60 * 1000 : 30 * 60 * 1000,
  });
}

/**
 * The games the logged-in user has rated (Letterboxd "Your Films" model).
 * Each carries the COMMUNITY average rating plus the user's OWN rating.
 */
async function getMyRatedGames(userId: string): Promise<CatalogGame[]> {
  const { data, error } = await supabase
    .from("user_game_reviews")
    .select(`
      game_id, star_rating, created_at,
      games ( name, cover_image, genres, platforms, release_date, metacritic_score, rawg_rating )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const community = await getUserRatingMap();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => {
    const c = community.get(r.game_id);
    return {
      id: r.game_id,
      name: r.games?.name ?? r.game_id,
      coverImage: r.games?.cover_image ?? "",
      rating: c?.avg ?? r.star_rating,
      ratingCount: c?.count ?? 1,
      userRating: r.star_rating,
      rawgRating: r.games?.rawg_rating ?? 0,
      metacriticScore: r.games?.metacritic_score ?? null,
      genres: r.games?.genres ?? [],
      platforms: r.games?.platforms ?? [],
      releaseDate: r.games?.release_date ?? "TBA",
      trending: false,
      description: "",
    } as CatalogGame;
  });
}

export function useMyRatedGames(userId: string | undefined) {
  return useQuery({
    queryKey: ["games", "mine", userId],
    queryFn: () => getMyRatedGames(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

/**
 * All games that have at least one community review.
 * Sorted by most reviewed, then highest community average.
 */
async function getCommunityReviewedGames(): Promise<CatalogGame[]> {
  const ratings = await getUserRatingMap();
  if (ratings.size === 0) return [];

  const gameIds = Array.from(ratings.keys());
  const { data: gamesData, error } = await supabase
    .from("games")
    .select("*")
    .in("id", gameIds);

  if (error || !gamesData) return [];

  const gameMap = new Map(gamesData.map((g) => [g.id, g]));

  const reviewed: CatalogGame[] = [];
  for (const [gameId, { avg, count }] of ratings) {
    if (count === 0) continue;
    const g = gameMap.get(gameId);
    if (!g) continue;

    reviewed.push({
      id: g.id,
      name: g.name,
      coverImage: g.cover_image ?? "",
      rating: avg,
      ratingCount: count,
      rawgRating: g.rawg_rating ?? 0,
      metacriticScore: g.metacritic_score ?? null,
      genres: g.genres ?? [],
      platforms: g.platforms ?? [],
      releaseDate: g.release_date ?? "TBA",
      trending: g.trending ?? false,
      description: g.description ?? "",
    });
  }

  return reviewed.sort((a, b) => {
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return b.rating - a.rating;
  });
}

export function useCommunityReviewedGames() {
  return useQuery({
    queryKey: ["games", "community-reviewed"],
    queryFn: getCommunityReviewedGames,
    staleTime: 60 * 1000,
  });
}

/**
 * Trending games — prefer the server-computed `trending_scores` table
 * (populated hourly by the compute-trending edge function). It blends
 * news mentions, Steam player counts, Twitch top-games rank, upcoming
 * esports matches, release proximity, community reviews, and RAWG ratings.
 *
 * Falls back to community-reviewed games if the table hasn't been populated yet.
 */
async function getTrendingGames(): Promise<CatalogGame[]> {
  // 1. Try server-side pre-computed trending scores first.
  const { data: scoreRows, error: scoreError } = await supabase
    .from("trending_scores")
    .select(`
      game_id, name, composite_score, news_score, steam_score, twitch_score,
      esports_score, community_score, rawg_score, release_proximity_score,
      games ( name, cover_image, genres, platforms, release_date, metacritic_score, rawg_rating, description )
    `)
    .order("composite_score", { ascending: false })
    .limit(12);

  if (!scoreError && scoreRows && scoreRows.length >= 5) {
    const ratings = await getUserRatingMap();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (scoreRows as any[]).map((r) => {
      const g = r.games;
      const rating = ratings.get(r.game_id);
      return {
        id: r.game_id,
        name: g?.name ?? r.name ?? r.game_id,
        coverImage: g?.cover_image ?? "",
        rating: rating?.avg ?? 0,
        ratingCount: rating?.count ?? 0,
        rawgRating: g?.rawg_rating ?? 0,
        metacriticScore: g?.metacritic_score ?? null,
        genres: g?.genres ?? [],
        platforms: g?.platforms ?? [],
        releaseDate: g?.release_date ?? "TBA",
        trending: true,
        description: g?.description ?? "",
        compositeScore: r.composite_score,
        newsScore: r.news_score,
        steamScore: r.steam_score,
        twitchScore: r.twitch_score,
        esportsScore: r.esports_score,
        communityScore: r.community_score,
        rawgScore: r.rawg_score,
        releaseProximityScore: r.release_proximity_score,
      } as CatalogGame;
    });
  }

  // 2. Fallback: community-reviewed games (no complex client-side compute)
  return getCommunityReviewedGames();
}

export function useTrendingGames() {
  return useQuery({
    queryKey: ["games", "trending"],
    queryFn: getTrendingGames,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
