// src/hooks/useGameDetails.ts
import { useQuery } from "@tanstack/react-query";
import { fetchGameDetail, normalisePlatforms } from "@/lib/rawg";
import { findOpenCriticGame, fetchOpenCriticDetail } from "@/lib/opencritic";
import { supabase } from "@/integrations/supabase/client";

export interface GameDetails {
  id: string;
  name: string;
  coverImage: string;
  description: string;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  developer: string;
  rawgRating: number;
  metacriticScore: number | null;
  steamAppId: number | null;
  openCritic: {
    id: number;
    score: number | null;
    percentRecommended: number | null;
    tier: string | null;
    reviews: Array<{
      outlet: string;
      outletLogo: string | null;
      author: string;
      score: number | null;
      snippet: string;
      url: string;
      publishedDate: string;
    }>;
  } | null;
}

async function getGameDetails(slug: string): Promise<GameDetails | null> {
  // 1. Fetch from RAWG
  const rawg = await fetchGameDetail(slug);

  // 2. Fetch from OpenCritic (parallel)
  const ocGame = await findOpenCriticGame(rawg.name);
  const ocDetail = ocGame ? await fetchOpenCriticDetail(ocGame.id) : null;

  // 3. Update Supabase cache
  if (ocDetail) {
    await supabase.from("games").upsert({
      id: slug,
      name: rawg.name,
      slug: rawg.slug,
      cover_image: rawg.background_image,
      rawg_rating: rawg.rating,
      metacritic_score: rawg.metacritic,
      opencritic_id: ocDetail.id,
      opencritic_score: ocDetail.topCriticScore,
      description: rawg.description_raw ?? "",
      genres: rawg.genres?.map((g) => g.slug) ?? [],
      platforms: normalisePlatforms(rawg.platforms),
      release_date: rawg.released,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "id" });
  }

  // 4. Find Steam appid from RAWG stores
  const steamStore = rawg.stores?.find((s) =>
    s.store.name.toLowerCase().includes("steam")
  );
  const steamAppId = steamStore ? null : null;  // RAWG doesn't expose appid directly

  return {
    id: rawg.slug,
    name: rawg.name,
    coverImage: rawg.background_image ?? "",
    description: rawg.description_raw ?? "",
    genres: rawg.genres?.map((g) => g.slug) ?? [],
    platforms: normalisePlatforms(rawg.platforms),
    releaseDate: rawg.released ?? "TBA",
    developer: "",  // RAWG /games/{slug} includes developers in a separate field
    rawgRating: rawg.rating,
    metacriticScore: rawg.metacritic ?? null,
    steamAppId,
    openCritic: ocDetail
      ? {
          id: ocDetail.id,
          score: ocDetail.topCriticScore,
          percentRecommended: ocDetail.percentRecommended,
          tier: ocDetail.tier,
          reviews: ocDetail.reviews.map((r) => ({
            outlet: r.outlet.name,
            outletLogo: r.outlet.imageUrl?.og ?? null,
            author: r.authors?.[0]?.name ?? "Staff",
            score: r.score,
            snippet: r.snippet,
            url: r.externalUrl,
            publishedDate: r.publishedDate,
          })),
        }
      : null,
  };
}

export function useGameDetails(slug: string | undefined) {
  return useQuery({
    queryKey: ["games", "detail", slug],
    queryFn: () => getGameDetails(slug!),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000,  // 30 min in-memory
  });
}
