import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGameDetail, normalisePlatforms } from "@/lib/rawg";
import { findOpenCriticGame, fetchOpenCriticDetail } from "@/lib/opencritic";
import { supabase } from "@/integrations/supabase/client";

export interface ExternalRating {
  source: string;
  score: number;
  scale: number;
}

export interface GameDetails {
  id: string;
  slug: string;
  name: string;
  coverImage: string;
  description: string;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  developer: string;
  publisher: string;
  rawgRating: number;
  metacriticScore: number | null;
  openCriticScore: number | null;
  externalRatings: ExternalRating[];
  ourRating: number;
  reviewCount: number;
  freeNow: boolean;
  freeOfferUrl: string | null;
  freeOfferStore: string | null;
  freeOfferEndsAt: string | null;
  descriptionStatus: string;
}

const GAME_SELECT = "id, slug, name, cover_image, description, genres, platforms, release_date, developer, publisher, rawg_rating, metacritic_score, opencritic_score, external_ratings, our_rating, review_count, free_now, free_offer_url, free_offer_store, free_offer_ends_at, description_status, expires_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGame(row: any): GameDetails {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    coverImage: row.cover_image ?? "",
    description: row.description ?? "",
    genres: row.genres ?? [],
    platforms: row.platforms ?? [],
    releaseDate: row.release_date ?? "TBA",
    developer: row.developer ?? "",
    publisher: row.publisher ?? "",
    rawgRating: Number(row.rawg_rating ?? 0),
    metacriticScore: row.metacritic_score ?? null,
    openCriticScore: row.opencritic_score ?? null,
    externalRatings: Array.isArray(row.external_ratings) ? row.external_ratings : [],
    ourRating: Number(row.our_rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    freeNow: Boolean(row.free_now),
    freeOfferUrl: row.free_offer_url ?? null,
    freeOfferStore: row.free_offer_store ?? null,
    freeOfferEndsAt: row.free_offer_ends_at ?? null,
    descriptionStatus: row.description_status ?? "missing",
  };
}

async function readCanonicalGame(slug: string) {
  const { data: byId, error: idError } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("id", slug)
    .maybeSingle();
  if (idError) throw idError;
  if (byId) return byId;

  // Older rows may still use a RAWG numeric ID while their permanent public
  // URL uses the canonical slug. Both routes must resolve to the same record.
  const { data: bySlug, error: slugError } = await supabase
    .from("games")
    .select(GAME_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (slugError) throw slugError;
  return bySlug;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshCanonicalGame(slug: string, cached: any | null): Promise<GameDetails | null> {
  try {
    const rawg = await fetchGameDetail(slug);
    const ocGame = await findOpenCriticGame(rawg.name);
    const ocDetail = ocGame ? await fetchOpenCriticDetail(ocGame.id) : null;
    const platforms = normalisePlatforms(rawg.platforms);
    const genres = rawg.genres?.map((genre) => genre.slug) ?? [];
    const developer = rawg.developers?.map((item) => item.name).join(", ") ?? "";
    const publisher = rawg.publishers?.map((item) => item.name).join(", ") ?? "";
    const externalRatings: ExternalRating[] = [
      ...(rawg.rating > 0 ? [{ source: "RAWG", score: rawg.rating, scale: 5 }] : []),
      ...(rawg.metacritic != null ? [{ source: "Metacritic", score: rawg.metacritic, scale: 100 }] : []),
      ...(ocDetail?.topCriticScore != null ? [{ source: "OpenCritic", score: ocDetail.topCriticScore, scale: 100 }] : []),
    ];

    const canonicalId = cached?.id ?? rawg.slug;
    const { error: upsertError } = await supabase.from("games").upsert({
      id: canonicalId,
      slug: rawg.slug,
      name: rawg.name,
      cover_image: rawg.background_image,
      genres,
      platforms,
      release_date: rawg.released,
      developer: developer || null,
      publisher: publisher || null,
      rawg_rating: rawg.rating,
      metacritic_score: rawg.metacritic,
      opencritic_id: ocDetail?.id ?? null,
      opencritic_score: ocDetail?.topCriticScore ?? null,
      external_ratings: externalRatings,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (upsertError) throw upsertError;

    const descriptionIsReady = cached?.description_status === "ready" && (cached.description?.length ?? 0) > 500;
    if (!descriptionIsReady) {
      await supabase.functions.invoke("enrich-game-description", {
        body: {
          gameId: canonicalId,
          facts: {
            name: rawg.name,
            developer,
            publisher,
            releaseDate: rawg.released,
            genres,
            platforms,
            sourceSummary: rawg.description_raw ?? "",
          },
        },
      });
    }

    const refreshed = await readCanonicalGame(canonicalId);
    return refreshed ? mapGame(refreshed) : null;
  } catch (error) {
    if (cached) return mapGame(cached);
    throw error;
  }
}

async function getGameDetails(slug: string): Promise<GameDetails | null> {
  const cached = await readCanonicalGame(slug);
  // Render the canonical record immediately. External metadata and the longer
  // editorial description are refreshed after paint so navigation never waits
  // on third-party APIs or the writing pipeline.
  if (cached) return mapGame(cached);
  return refreshCanonicalGame(slug, null);
}

export function useGameDetails(slug: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["games", "detail", slug],
    queryFn: () => getGameDetails(slug!),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000,
  });
  const refreshFingerprint = query.data
    ? [query.data.descriptionStatus, query.data.description.length, query.data.externalRatings.length, query.data.developer].join("|")
    : "";

  useEffect(() => {
    if (!slug || !refreshFingerprint) return;
    const current = queryClient.getQueryData<GameDetails>(["games", "detail", slug]);
    if (!current) return;
    const needsDescription = current.descriptionStatus !== "ready" || current.description.length < 500;
    const needsMetadata = current.externalRatings.length === 0
      || !current.developer
      || !current.releaseDate
      || current.releaseDate === "TBA"
      || !current.coverImage;
    if (!needsDescription && !needsMetadata) return;

    let cancelled = false;
    void readCanonicalGame(slug)
      .then((cached) => refreshCanonicalGame(slug, cached))
      .then((refreshed) => {
        if (!cancelled && refreshed) {
          queryClient.setQueryData(["games", "detail", slug], refreshed);
        }
      })
      .catch(() => {
        // The canonical record already rendered; a temporary metadata provider
        // failure should not replace the page with an error state.
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient, refreshFingerprint, slug]);

  return query;
}
