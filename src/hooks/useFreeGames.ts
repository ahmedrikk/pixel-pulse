import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FreeGameKind = "keep" | "timed" | "other";

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
  endsAt: string | null;
}

async function getFreeGames(): Promise<FreeGameOffer[]> {
  const { data, error } = await supabase
    .from("free_game_offers")
    .select("id, title, description, instructions, image_url, thumbnail_url, offer_url, source_url, source_name, store_name, platforms, offer_kind, worth_text, users_count, published_at, ends_at")
    .eq("status", "active")
    .order("ends_at", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
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
    endsAt: row.ends_at,
  }));
}

export function useFreeGames() {
  return useQuery({
    queryKey: ["free-games", "active"],
    queryFn: getFreeGames,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
