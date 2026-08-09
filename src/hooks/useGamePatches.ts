import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalisePatchEditorial, type PatchEditorialContent } from "@/lib/patchEditorial";

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
  editorial: PatchEditorialContent | null;
  metaTitle: string | null;
  metaDescription: string | null;
  seoSlug: string;
}

const PATCH_PAGE_SIZE = 12;
const PATCH_SELECT = "id, game_id, title, summary, content_text, source_url, source_name, patch_type, version_label, image_url, published_at, editorial_content, meta_title, meta_description, seo_slug";

export function toPatchSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "patch-notes";
}

export function patchPath(patch: Pick<GamePatch, "gameId" | "seoSlug" | "title">): string {
  return `/game-patch/${patch.gameId}/${patch.seoSlug || toPatchSlug(patch.title)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPatch(row: any): GamePatch {
  return {
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
    editorial: normalisePatchEditorial(row.editorial_content),
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    seoSlug: row.seo_slug || toPatchSlug(row.title),
  };
}

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
    .select(PATCH_SELECT, { count: "exact" })
    .eq("game_id", gameId)
    .eq("editorial_status", "ready")
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  const patches: GamePatch[] = (data ?? []).filter((row) => row.title).map(mapPatch);

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
    .select(PATCH_SELECT)
    .eq("game_id", gameId)
    .eq("editorial_status", "ready")
    .order("published_at", { ascending: false })
    .limit(4);
  if (error) throw error;
  return (data ?? []).filter((row) => row.title).map(mapPatch);
}

async function getGamePatch(patchKey: string, gameId?: string): Promise<GamePatch | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(patchKey);
  let request = supabase
    .from("game_patches")
    .select(PATCH_SELECT)
    .eq(isUuid ? "id" : "seo_slug", patchKey)
    .eq("editorial_status", "ready");
  if (gameId) request = request.eq("game_id", gameId);
  const { data, error } = await request.order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.title ? mapPatch(data) : null;
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

export function useGamePatch(patchId: string | undefined, gameId?: string) {
  return useQuery({
    queryKey: ["game-patches", "detail", gameId, patchId],
    queryFn: () => getGamePatch(patchId!, gameId),
    enabled: !!patchId,
    staleTime: 5 * 60 * 1000,
  });
}
