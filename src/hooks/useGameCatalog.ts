// src/hooks/useGameCatalog.ts
import { useQuery } from "@tanstack/react-query";
import { fetchGameList, normalisePlatforms, type RawgGame } from "@/lib/rawg";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogGame {
  id: string;           // RAWG slug
  name: string;
  coverImage: string;
  rating: number;       // community average USER star rating (0–5)
  ratingCount: number;  // how many users have reviewed it
  userRating?: number;  // the logged-in user's own star rating, if any
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
    metacriticScore: g.metacritic ?? null,
    genres: g.genres?.map((gen) => gen.slug) ?? [],
    platforms: normalisePlatforms(g.platforms),
    releaseDate: g.released ?? "TBA",
    trending: g.rating >= 4.2 && (g.metacritic ?? 0) >= 80,
    description: "",  // fetched on detail page
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getCatalogGames(params: {
  search?: string;
  genre?: string;
  ordering?: string;
}): Promise<CatalogGame[]> {
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

    const result = await fetchGameList({
      page_size: 40,
      search: params.search,
      genres: params.genre ? rawgGenreMap[params.genre] : undefined,
      ordering: params.ordering ?? "-rating",
    });

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
    queryFn: () => getCatalogGames(params),
    staleTime: 10 * 60 * 1000,  // 10 min in-memory
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
      games ( name, cover_image, genres, platforms, release_date, metacritic_score )
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
