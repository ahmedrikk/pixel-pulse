// src/hooks/useGameCatalog.ts
import { useQuery } from "@tanstack/react-query";
import { fetchGameList, normalisePlatforms, type RawgGame } from "@/lib/rawg";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogGame {
  id: string;           // RAWG slug
  name: string;
  coverImage: string;
  rating: number;       // 0–5
  metacriticScore: number | null;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  trending: boolean;
  description: string;
}

function mapRawgToCatalog(g: RawgGame): CatalogGame {
  return {
    id: g.slug,
    name: g.name,
    coverImage: g.background_image ?? "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80",
    rating: Math.round(g.rating * 10) / 10,
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
  // 1. Try Supabase cache (only for unfiltered requests)
  if (!params.search && !params.genre) {
    const { data } = await supabase
      .from("games")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("rawg_rating", { ascending: false })
      .limit(40);

    if (data && data.length >= 10) {
      return data.map((g) => ({
        id: g.id,
        name: g.name,
        coverImage: g.cover_image ?? "",
        rating: g.rawg_rating ?? 0,
        metacriticScore: g.metacritic_score ?? null,
        genres: g.genres ?? [],
        platforms: g.platforms ?? [],
        releaseDate: g.release_date ?? "TBA",
        trending: g.trending ?? false,
        description: g.description ?? "",
      }));
    }
  }

  // 2. Fetch from RAWG
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

  const games = result.results.map(mapRawgToCatalog);

  // 3. Write to Supabase cache (only unfiltered)
  if (!params.search && !params.genre && games.length > 0) {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await supabase.from("games").upsert(
      games.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.id,
        cover_image: g.coverImage,
        rawg_rating: g.rating,
        metacritic_score: g.metacriticScore,
        genres: g.genres,
        platforms: g.platforms,
        release_date: g.releaseDate,
        trending: g.trending,
        description: g.description,
        expires_at: expiresAt,
      })),
      { onConflict: "id" }
    );
  }

  return games;
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
