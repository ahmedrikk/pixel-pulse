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
  popularity: number;
  externalReviewCount: number;
}

export interface GenreRankingGroup {
  genre: string;
  games: CatalogGame[];
}

/** Read Talus aggregates from the canonical Game rows. */
async function withCanonicalRatings(games: CatalogGame[]): Promise<CatalogGame[]> {
  if (games.length === 0) return games;
  const { data } = await supabase
    .from("games")
    .select("id, our_rating, review_count")
    .in("id", games.map((game) => game.id));
  const ratings = new Map((data ?? []).map((row) => [row.id, {
    avg: Number(row.our_rating ?? 0),
    count: Number(row.review_count ?? 0),
  }]));
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
    popularity: Number(g.added ?? 0),
    externalReviewCount: Number(g.ratings_count ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCanonicalToCatalog(g: any): CatalogGame {
  return {
    id: g.id,
    name: g.name,
    coverImage: g.cover_image ?? "",
    rating: Number(g.our_rating ?? 0),
    ratingCount: Number(g.review_count ?? 0),
    rawgRating: Number(g.rawg_rating ?? 0),
    metacriticScore: g.metacritic_score ?? null,
    genres: g.genres ?? [],
    platforms: g.platforms ?? [],
    releaseDate: g.release_date ?? "TBA",
    trending: Boolean(g.trending),
    description: g.description ?? "",
    popularity: 0,
    externalReviewCount: 0,
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

  // Search the Talus catalog immediately. This keeps search useful even when
  // RAWG is slow or temporarily unavailable, and makes existing games such as
  // Fortnite appear without waiting for an external round trip.
  if (params.search) {
    const escaped = params.search.replace(/[%_]/g, "");
    const { data } = await supabase
      .from("games")
      .select("*")
      .ilike("name", `%${escaped}%`)
      .order("review_count", { ascending: false })
      .limit(20);
    games = (data ?? []).map(mapCanonicalToCatalog);
  }

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
        rating: Number(g.our_rating ?? 0),
        ratingCount: Number(g.review_count ?? 0),
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
  if (games.length === 0 || params.search) {
    const rawgGenreMap: Record<string, string> = {
      "action-rpg": "action,role-playing-games-rpg",
      fps: "shooter",
      adventure: "adventure",
      strategy: "strategy",
      horror: "action",  // RAWG doesn't have a dedicated horror genre
      racing: "racing",
      sports: "sports",
    };

    let result: Awaited<ReturnType<typeof fetchGameList>> | null = null;
    try {
      result = await fetchGameList(
        {
          page_size: 40,
          search: params.search,
          genres: params.genre ? rawgGenreMap[params.genre] : undefined,
          ordering: params.ordering ?? "-rating",
        },
        signal
      );
    } catch (error) {
      if (games.length === 0) throw error;
    }

    const rawgGames = (result?.results ?? []).map(mapRawgToCatalog);
    games = [...new Map([...games, ...rawgGames].map((game) => [game.id, game])).values()];

    // 3. Every discovered title becomes (or refreshes) one canonical Game row.
    if (result && result.results.length > 0) {
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

  return withCanonicalRatings(games);
}

async function getRecentPopularGames(signal?: AbortSignal): Promise<CatalogGame[]> {
  const today = new Date();
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 1);
  const date = (value: Date) => value.toISOString().slice(0, 10);

  const { data: savedRows } = await supabase
    .from("games")
    .select("*")
    .not("release_date", "is", null)
    .neq("release_date", "TBA")
    .lte("release_date", date(today))
    .gte("release_date", date(start))
    .order("review_count", { ascending: false })
    .order("rawg_rating", { ascending: false })
    .limit(60);
  const saved = (savedRows ?? []).map(mapCanonicalToCatalog).filter((game) => game.coverImage);
  if (saved.length >= 6) {
    const score = (game: CatalogGame) => game.ratingCount * 10 + game.rawgRating * 20 + (game.metacriticScore ?? 0);
    return saved.sort((a, b) => score(b) - score(a) || Date.parse(b.releaseDate) - Date.parse(a.releaseDate)).slice(0, 6);
  }

  try {
    const result = await fetchGameList({
      page_size: 20,
      dates: `${date(start)},${date(today)}`,
      ordering: "-added",
    }, signal);
    return withCanonicalRatings(
      result.results
        .filter((game) => game.background_image && game.released)
        .map(mapRawgToCatalog)
        .sort((a, b) => (b.popularity + b.externalReviewCount * 4) - (a.popularity + a.externalReviewCount * 4))
        .slice(0, 6),
    );
  } catch {
    const { data } = await supabase
      .from("games")
      .select("*")
      .not("release_date", "is", null)
      .neq("release_date", "TBA")
      .order("release_date", { ascending: false })
      .limit(100);
    const mapped = (data ?? []).map(mapCanonicalToCatalog);
    const valid = mapped.filter((game) => !Number.isNaN(Date.parse(game.releaseDate)) && new Date(game.releaseDate) <= today);
    const recent = valid.filter((game) => new Date(game.releaseDate) >= start);
    const score = (game: CatalogGame) => game.ratingCount * 10 + game.rawgRating * 20 + (game.metacriticScore ?? 0);
    return (recent.length >= 6 ? recent : valid)
      .sort((a, b) => score(b) - score(a) || Date.parse(b.releaseDate) - Date.parse(a.releaseDate))
      .slice(0, 6);
  }
}

export function useRecentPopularGames() {
  const cacheKey = "talus:recent-popular-games:v1";
  const maxAge = 21 * 24 * 60 * 60 * 1000;
  return useQuery({
    queryKey: ["games", "recent-popular"],
    queryFn: async ({ signal }) => {
      const games = await getRecentPopularGames(signal);
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), games })); } catch { /* storage unavailable */ }
      return games;
    },
    initialData: () => {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null") as { savedAt: number; games: CatalogGame[] } | null;
        return cached && Date.now() - cached.savedAt < maxAge ? cached.games : undefined;
      } catch { return undefined; }
    },
    initialDataUpdatedAt: () => {
      try { return (JSON.parse(localStorage.getItem(cacheKey) ?? "null") as { savedAt?: number } | null)?.savedAt; } catch { return undefined; }
    },
    staleTime: maxAge,
    gcTime: maxAge,
  });
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

async function searchCanonicalGames(search: string): Promise<CatalogGame[]> {
  const escaped = search.replace(/[%_]/g, "");
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .ilike("name", `%${escaped}%`)
    .order("review_count", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map(mapCanonicalToCatalog);
}

export function useCanonicalGameSearch(search: string | undefined) {
  return useQuery({
    queryKey: ["games", "canonical-search", search],
    queryFn: () => searchCanonicalGames(search!),
    enabled: !!search,
    staleTime: 5 * 60 * 1000,
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
      games ( name, cover_image, genres, platforms, release_date, metacritic_score, rawg_rating, our_rating, review_count )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => {
    return {
      id: r.game_id,
      name: r.games?.name ?? r.game_id,
      coverImage: r.games?.cover_image ?? "",
      rating: r.games?.our_rating ?? r.star_rating,
      ratingCount: r.games?.review_count ?? 1,
      userRating: r.star_rating,
      rawgRating: r.games?.rawg_rating ?? 0,
      metacriticScore: r.games?.metacritic_score ?? null,
      genres: r.games?.genres ?? [],
      platforms: r.games?.platforms ?? [],
      releaseDate: r.games?.release_date ?? "TBA",
      trending: false,
      description: "",
      popularity: 0,
      externalReviewCount: 0,
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
  const { data: gamesData, error } = await supabase
    .from("games")
    .select("*")
    .gt("review_count", 0)
    .order("review_count", { ascending: false })
    .order("our_rating", { ascending: false });

  if (error || !gamesData) return [];

  return gamesData.map((g) => ({
      id: g.id,
      name: g.name,
      coverImage: g.cover_image ?? "",
      rating: Number(g.our_rating ?? 0),
      ratingCount: Number(g.review_count ?? 0),
      rawgRating: g.rawg_rating ?? 0,
      metacriticScore: g.metacritic_score ?? null,
      genres: g.genres ?? [],
      platforms: g.platforms ?? [],
      releaseDate: g.release_date ?? "TBA",
      trending: g.trending ?? false,
      description: g.description ?? "",
      popularity: 0,
      externalReviewCount: 0,
    }));
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
      games ( name, cover_image, genres, platforms, release_date, metacritic_score, rawg_rating, description, our_rating, review_count )
    `)
    .order("composite_score", { ascending: false })
    .limit(12);

  if (!scoreError && scoreRows && scoreRows.length >= 5) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (scoreRows as any[]).map((r) => {
      const g = r.games;
      return {
        id: r.game_id,
        name: g?.name ?? r.name ?? r.game_id,
        coverImage: g?.cover_image ?? "",
        rating: Number(g?.our_rating ?? 0),
        ratingCount: Number(g?.review_count ?? 0),
        rawgRating: g?.rawg_rating ?? 0,
        metacriticScore: g?.metacritic_score ?? null,
        genres: g?.genres ?? [],
        platforms: g?.platforms ?? [],
        releaseDate: g?.release_date ?? "TBA",
        trending: true,
        description: g?.description ?? "",
        popularity: 0,
        externalReviewCount: 0,
        compositeScore: r.composite_score,
        newsScore: r.news_score,
        steamScore: r.steam_score,
        twitchScore: r.twitch_score,
        esportsScore: r.esports_score,
        communityScore: r.community_score,
        rawgScore: r.rawg_score,
        releaseProximityScore: r.release_proximity_score,
      } as CatalogGame;
    }).sort((a, b) => {
      // "Trending" on Reviews is deliberately driven by people playing now
      // (Steam signal) and release recency, not news-volume alone.
      const aScore = Number(a.steamScore ?? 0) * 0.75 + Number(a.releaseProximityScore ?? 0) * 0.25;
      const bScore = Number(b.steamScore ?? 0) * 0.75 + Number(b.releaseProximityScore ?? 0) * 0.25;
      return bScore - aScore;
    }).slice(0, 12);
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

const GENRE_ORDER = [
  "action", "role-playing-games-rpg", "adventure", "strategy", "simulation",
  "shooter", "sports", "racing", "fighting", "horror", "puzzle",
  "platformer", "open-world", "massively-multiplayer", "indie", "sandbox",
];

async function getGenreRankings(): Promise<GenreRankingGroup[]> {
  const { data, error } = await supabase.rpc("get_genre_game_rankings");
  if (error) throw error;

  const grouped = new Map<string, CatalogGame[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const items = grouped.get(row.genre) ?? [];
    items.push({
      id: row.game_id,
      name: row.name,
      coverImage: row.cover_image ?? "",
      rating: Number(row.our_rating ?? 0),
      ratingCount: Number(row.review_count ?? 0),
      rawgRating: Number(row.rawg_rating ?? 0),
      metacriticScore: null,
      genres: [row.genre],
      platforms: row.platforms ?? [],
      releaseDate: row.release_date ?? "TBA",
      trending: false,
      description: "",
      popularity: Number(row.popularity_score ?? 0),
      externalReviewCount: 0,
    });
    grouped.set(row.genre, items);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => {
      const aIndex = GENRE_ORDER.indexOf(a);
      const bIndex = GENRE_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    })
    .map(([genre, games]) => ({ genre, games }));
}

export function useGenreRankings() {
  return useQuery({
    queryKey: ["games", "genre-rankings"],
    queryFn: getGenreRankings,
    staleTime: 60 * 1000,
  });
}
