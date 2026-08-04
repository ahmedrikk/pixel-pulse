import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PatchType = "patch" | "hotfix" | "balance" | "maintenance" | "update";

export interface PatchGame {
  id: string;
  name: string;
  coverImage: string;
  platforms: string[];
  genres: string[];
  steamAppId: number;
  patchCount: number;
  latestPatchTitle: string | null;
  latestPatchType: PatchType | null;
  latestPatchAt: string | null;
}

export interface GamePatch {
  id: string;
  gameId: string;
  title: string;
  summary: string;
  contentText: string;
  sourceUrl: string;
  sourceName: string;
  patchType: PatchType;
  versionLabel: string | null;
  imageUrl: string | null;
  publishedAt: string;
}

const PATCH_PAGE_SIZE = 12;

async function getPatchGames(): Promise<PatchGame[]> {
  const { data, error } = await supabase.rpc("get_patch_game_catalog");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.game_id,
    name: row.name,
    coverImage: row.cover_image
      ?? `https://cdn.akamai.steamstatic.com/steam/apps/${row.steam_appid}/header.jpg`,
    platforms: row.platforms ?? [],
    genres: row.genres ?? [],
    steamAppId: row.steam_appid,
    patchCount: Number(row.patch_count ?? 0),
    latestPatchTitle: row.latest_patch_title,
    latestPatchType: row.latest_patch_type as PatchType | null,
    latestPatchAt: row.latest_patch_at,
  }));
}

async function getPatchPage(gameId: string, page: number) {
  const from = page * PATCH_PAGE_SIZE;
  const to = from + PATCH_PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from("game_patches")
    .select("id, game_id, title, summary, content_text, source_url, source_name, patch_type, version_label, image_url, published_at", { count: "exact" })
    .eq("game_id", gameId)
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  const patches: GamePatch[] = (data ?? []).map((row) => ({
    id: row.id,
    gameId: row.game_id,
    title: row.title,
    summary: row.summary,
    contentText: row.content_text,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    patchType: row.patch_type as PatchType,
    versionLabel: row.version_label,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
  }));

  return {
    patches,
    page,
    total: count ?? patches.length,
    hasMore: from + patches.length < (count ?? patches.length),
  };
}

async function getRecentGamePatches(gameId: string): Promise<GamePatch[]> {
  const { data, error } = await supabase
    .from("game_patches")
    .select("id, game_id, title, summary, content_text, source_url, source_name, patch_type, version_label, image_url, published_at")
    .eq("game_id", gameId)
    .order("published_at", { ascending: false })
    .limit(4);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    gameId: row.game_id,
    title: row.title,
    summary: row.summary,
    contentText: row.content_text,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    patchType: row.patch_type as PatchType,
    versionLabel: row.version_label,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
  }));
}

async function getGamePatch(patchId: string): Promise<GamePatch | null> {
  const { data, error } = await supabase
    .from("game_patches")
    .select("id, game_id, title, summary, content_text, source_url, source_name, patch_type, version_label, image_url, published_at")
    .eq("id", patchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    gameId: data.game_id,
    title: data.title,
    summary: data.summary,
    contentText: data.content_text,
    sourceUrl: data.source_url,
    sourceName: data.source_name,
    patchType: data.patch_type as PatchType,
    versionLabel: data.version_label,
    imageUrl: data.image_url,
    publishedAt: data.published_at,
  };
}

export function usePatchGames() {
  return useQuery({
    queryKey: ["game-patches", "catalog"],
    queryFn: getPatchGames,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function usePatchGame(gameId: string | undefined) {
  const catalog = usePatchGames();
  return {
    ...catalog,
    data: catalog.data?.find((game) => game.id === gameId) ?? null,
  };
}

export function useGamePatchHistory(gameId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["game-patches", "history", gameId],
    queryFn: ({ pageParam }) => getPatchPage(gameId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentGamePatches(gameId: string | undefined) {
  return useQuery({
    queryKey: ["game-patches", "recent", gameId],
    queryFn: () => getRecentGamePatches(gameId!),
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGamePatch(patchId: string | undefined) {
  return useQuery({
    queryKey: ["game-patches", "detail", patchId],
    queryFn: () => getGamePatch(patchId!),
    enabled: !!patchId,
    staleTime: 5 * 60 * 1000,
  });
}
