import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FreeGameKind = "keep" | "timed" | "other";
export type FreeGameStatus = "active" | "upcoming";

export interface FreeGameOffer {
  id: string;
  title: string;
  description: string;
  instructions: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  offerUrl: string;
  sourceUrl: string;
  sourceName: string;
  storeName: string;
  platforms: string[];
  offerKind: FreeGameKind;
  worthText: string | null;
  usersCount: number;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: FreeGameStatus;
}

function canonicalTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/\([^)]*(?:epic|steam|gog|itch|mobile)[^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourcePriority(sourceName: string) {
  return sourceName === "Epic Games Store" ? 2 : 1;
}

async function getFreeGames(): Promise<FreeGameOffer[]> {
  const { data, error } = await supabase
    .from("free_game_offers")
    .select("id, title, description, instructions, image_url, thumbnail_url, offer_url, source_url, source_name, store_name, platforms, offer_kind, worth_text, users_count, published_at, starts_at, ends_at, status")
    .in("status", ["active", "upcoming"])
    .order("ends_at", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false });

  if (error) throw error;
  const mapped: FreeGameOffer[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    offerUrl: row.offer_url,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    storeName: row.store_name,
    platforms: row.platforms ?? [],
    offerKind: row.offer_kind as FreeGameKind,
    worthText: row.worth_text,
    usersCount: row.users_count,
    publishedAt: row.published_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as FreeGameStatus,
  }));

  const deduplicated = new Map<string, FreeGameOffer>();
  for (const offer of mapped.sort((a, b) => sourcePriority(b.sourceName) - sourcePriority(a.sourceName))) {
    const key = `${canonicalTitle(offer.title)}:${offer.storeName}`;
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, offer);
      continue;
    }
    existing.usersCount = Math.max(existing.usersCount, offer.usersCount);
    existing.description ||= offer.description;
    existing.instructions ||= offer.instructions;
    existing.worthText ||= offer.worthText;
  }

  return [...deduplicated.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    const aDate = a.status === "upcoming" ? a.startsAt : a.endsAt;
    const bDate = b.status === "upcoming" ? b.startsAt : b.endsAt;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
}

export function useFreeGames() {
  return useQuery({
    queryKey: ["free-games", "active"],
    queryFn: getFreeGames,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
