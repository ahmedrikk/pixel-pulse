import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTrustedServerRequest, unauthorizedResponse } from "../_shared/server-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const GAMERPOWER_URL = "https://www.gamerpower.com/api/giveaways?type=game&sort-by=date";
const EPIC_PROMOTIONS_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";

type SupabaseClient = ReturnType<typeof createClient>;
type OfferStatus = "active" | "upcoming";

interface GamerPowerGiveaway {
  id: number;
  title: string;
  worth?: string;
  thumbnail?: string;
  image?: string;
  description?: string;
  instructions?: string;
  open_giveaway_url?: string;
  open_giveaway?: string;
  gamerpower_url?: string;
  published_date?: string;
  type?: string;
  platforms?: string;
  end_date?: string;
  users?: number;
  status?: string;
}

interface EpicPromotion {
  startDate?: string;
  endDate?: string;
  discountSetting?: { discountPercentage?: number };
}

interface EpicElement {
  id: string;
  title: string;
  description?: string;
  effectiveDate?: string;
  productSlug?: string | null;
  catalogNs?: { mappings?: Array<{ pageSlug?: string }> };
  keyImages?: Array<{ type?: string; url?: string }>;
  price?: { totalPrice?: { fmtPrice?: { originalPrice?: string } } };
  promotions?: {
    promotionalOffers?: Array<{ promotionalOffers?: EpicPromotion[] }>;
    upcomingPromotionalOffers?: Array<{ promotionalOffers?: EpicPromotion[] }>;
  } | null;
}

interface EpicResponse {
  data?: { Catalog?: { searchStore?: { elements?: EpicElement[] } } };
}

interface OfferRow {
  source_name: string;
  external_id: string;
  game_id: string;
  instructions: string;
  offer_url: string;
  source_url: string;
  store_name: string;
  offer_kind: "keep" | "timed" | "other";
  worth_text: string | null;
  users_count: number;
  published_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: OfferStatus;
  last_seen_at: string;
  updated_at: string;
}

interface GameSeed {
  id: string;
  slug: string;
  name: string;
  cover_image: string | null;
  platforms: string[];
  expires_at: string;
  updated_at: string;
  sourceSummary: string;
}

interface SyncResult {
  source: string;
  active: number;
  upcoming: number;
  enrichmentSeeds: GameSeed[];
}

function parseDate(value?: string): string | null {
  if (!value || value.toLowerCase() === "n/a") return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeTitle(value: string): string {
  return value
    .replace(/\s*\((?:Steam|Epic Games|GOG|itch\.io|PC|Mobile)\)\s*Giveaway\s*$/i, "")
    .replace(/\s*Giveaway\s*$/i, "")
    .trim();
}

function canonicalGameName(value: string): string {
  return normalizeTitle(value)
    .replace(/\s*\((?:Steam|Epic Games|GOG|itch\.io|PC|Mobile)\)\s*(?:Key)?\s*$/i, "")
    .replace(/\s+Steam\s+Key\s*$/i, "")
    .trim();
}

function gameSlug(value: string): string {
  return canonicalGameName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitPlatforms(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((platform) => platform.trim())
    .filter(Boolean);
}

function detectStore(platforms: string[]): string {
  const joined = platforms.join(" ").toLowerCase();
  if (joined.includes("epic")) return "Epic Games";
  if (joined.includes("steam")) return "Steam";
  if (joined.includes("gog")) return "GOG";
  if (joined.includes("itch")) return "itch.io";
  if (joined.includes("playstation")) return "PlayStation";
  if (joined.includes("xbox")) return "Xbox";
  if (joined.includes("android") || joined.includes("ios")) return "Mobile";
  if (joined.includes("drm-free")) return "DRM-Free";
  return platforms[platforms.length - 1] || "Other";
}

function detectKind(item: GamerPowerGiveaway): "keep" | "timed" | "other" {
  const content = `${item.title} ${item.description ?? ""} ${item.instructions ?? ""}`.toLowerCase();
  if (/free weekend|play for free|free-to-play event|trial/.test(content)) return "timed";
  if (/dlc|add-on|in-game|loot/.test(content)) return "other";
  return "keep";
}

function getEpicSlug(item: EpicElement): string | null {
  const mapping = item.catalogNs?.mappings?.find((entry) => entry.pageSlug)?.pageSlug;
  if (mapping) return mapping;
  const productSlug = item.productSlug?.split("/")[0];
  return productSlug && productSlug !== "[]" ? productSlug : null;
}

function getEpicImage(item: EpicElement): string | null {
  const preferredTypes = ["OfferImageWide", "DieselStoreFrontWide", "DieselGameBoxWide"];
  for (const type of preferredTypes) {
    const match = item.keyImages?.find((image) => image.type === type && image.url);
    if (match?.url) return match.url;
  }
  return item.keyImages?.find((image) => image.url)?.url ?? null;
}

function getEpicPeriods(item: EpicElement): EpicPromotion[] {
  const current = item.promotions?.promotionalOffers?.flatMap((group) => group.promotionalOffers ?? []) ?? [];
  const upcoming = item.promotions?.upcomingPromotionalOffers?.flatMap((group) => group.promotionalOffers ?? []) ?? [];
  return [...current, ...upcoming];
}

function isDirectClaimUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.protocol === "https:" && hostname !== "gamerpower.com";
  } catch {
    return false;
  }
}

async function resolveDirectClaimUrl(item: GamerPowerGiveaway): Promise<string | null> {
  const candidate = item.open_giveaway_url || item.open_giveaway;
  if (!candidate) return null;

  try {
    const response = await fetch(candidate, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; TalusFreeGames/1.0; +https://pixel-pulse-roan.vercel.app)",
      },
    });
    const resolved = new URL(response.url);
    await response.body?.cancel();
    if (!isDirectClaimUrl(resolved.toString())) return null;
    return resolved.toString();
  } catch (error) {
    console.warn(`Could not resolve direct claim URL for GamerPower ${item.id}`, error);
    return null;
  }
}

async function ensureGames(
  supabase: SupabaseClient,
  seeds: GameSeed[],
  preferSourceMetadata = false,
): Promise<Map<string, string>> {
  if (seeds.length === 0) return new Map();

  const unique = [...new Map(seeds.map((seed) => [seed.id, seed])).values()];
  const proposedIds = unique.map((seed) => seed.id);
  const { data: existingBySlug, error: slugLookupError } = await supabase
    .from("games")
    .select("id, slug")
    .in("slug", unique.map((seed) => seed.slug));
  if (slugLookupError) throw slugLookupError;

  const { data: existingById, error: idLookupError } = await supabase
    .from("games")
    .select("id, slug")
    .in("id", proposedIds);
  if (idLookupError) throw idLookupError;

  const canonicalBySlug = new Map<string, string>();
  for (const game of [...(existingBySlug ?? []), ...(existingById ?? [])]) {
    canonicalBySlug.set(game.slug, game.id);
  }
  const idMap = new Map(unique.map((seed) => [seed.id, canonicalBySlug.get(seed.slug) ?? seed.id]));
  const rows = [...new Map(unique.map(({ sourceSummary: _sourceSummary, ...seed }) => {
    const canonicalId = idMap.get(seed.id) ?? seed.id;
    return [canonicalId, { ...seed, id: canonicalId }];
  })).values()];
  const { error } = await supabase
    .from("games")
    .upsert(rows, {
      onConflict: "id",
      ignoreDuplicates: !preferSourceMetadata,
    });
  if (error) throw error;
  return idMap;
}

async function enrichMissingGames(
  supabase: SupabaseClient,
  functionCaller: SupabaseClient,
  seeds: GameSeed[],
) {
  const unique = [...new Map(seeds.map((seed) => [seed.id, seed])).values()];
  if (unique.length === 0) return { attempted: 0, completed: 0 };

  // Claim a small batch atomically. The database function uses row locks so
  // overlapping 30-minute workers cannot spend generation budget twice.
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_game_description_jobs",
    { candidate_ids: unique.map((seed) => seed.id), limit_count: 3 },
  );
  if (claimError) throw claimError;

  const seedById = new Map(unique.map((seed) => [seed.id, seed]));
  const settled = await Promise.allSettled((claimed ?? []).map((game) => {
    const seed = seedById.get(game.game_id);
    return functionCaller.functions.invoke("enrich-game-description", {
      body: {
        gameId: game.game_id,
        facts: {
          name: seed?.name,
          platforms: seed?.platforms ?? [],
          sourceSummary: seed?.sourceSummary ?? "",
        },
      },
    }).then(({ data, error }) => {
      if (error || data?.ok === false) throw error ?? new Error(data?.error ?? "Description enrichment failed");
      return data;
    });
  }));

  return {
    attempted: settled.length,
    completed: settled.filter((result) => result.status === "fulfilled").length,
  };
}

async function syncRows(supabase: SupabaseClient, sourceName: string, rows: OfferRow[], now: string) {
  if (rows.length === 0) throw new Error(`${sourceName} returned no valid game offers`);

  const { error: upsertError } = await supabase
    .from("free_game_offers")
    .upsert(rows, { onConflict: "source_name,external_id" });
  if (upsertError) throw upsertError;

  const { data: existing, error: existingError } = await supabase
    .from("free_game_offers")
    .select("external_id")
    .eq("source_name", sourceName)
    .in("status", ["active", "upcoming"]);
  if (existingError) throw existingError;

  const currentIds = new Set(rows.map((row) => row.external_id));
  const staleIds = (existing ?? [])
    .map((row) => row.external_id as string)
    .filter((externalId) => !currentIds.has(externalId));

  if (staleIds.length > 0) {
    const { error: expireError } = await supabase
      .from("free_game_offers")
      .update({ status: "expired", updated_at: now })
      .eq("source_name", sourceName)
      .in("external_id", staleIds);
    if (expireError) throw expireError;
  }

  return { source: sourceName, active: rows.filter((row) => row.status === "active").length, upcoming: rows.filter((row) => row.status === "upcoming").length };
}

async function syncGamerPower(supabase: SupabaseClient, now: string): Promise<SyncResult> {
  const response = await fetch(GAMERPOWER_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Talus/1.0 (https://pixel-pulse-roan.vercel.app)",
    },
  });
  if (!response.ok) throw new Error(`GamerPower returned ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Unexpected GamerPower response");

  const active = (payload as GamerPowerGiveaway[]).filter((item) =>
    item.id && item.title && item.status?.toLowerCase() === "active"
  );
  const { data: existingOffers, error: existingOfferError } = await supabase
    .from("free_game_offers")
    .select("external_id, offer_url")
    .eq("source_name", "GamerPower")
    .in("external_id", active.map((item) => String(item.id)));
  if (existingOfferError) throw existingOfferError;
  const cachedDirectUrls = new Map((existingOffers ?? [])
    .filter((offer) => isDirectClaimUrl(offer.offer_url))
    .map((offer) => [offer.external_id, offer.offer_url]));

  const prepared: Array<{ seed: GameSeed; row: OfferRow }> = [];
  for (let index = 0; index < active.length; index += 5) {
    const batch = await Promise.all(active.slice(index, index + 5).map(async (item) => {
      const offerUrl = cachedDirectUrls.get(String(item.id)) ?? await resolveDirectClaimUrl(item);
      if (!offerUrl) {
        console.warn(`Skipping GamerPower ${item.id}: direct official claim URL unavailable`);
        return null;
      }
      const platforms = splitPlatforms(item.platforms);
      const name = canonicalGameName(item.title);
      const id = gameSlug(name);
      if (!id) return null;

      return {
        seed: {
          id,
          slug: id,
          name,
          cover_image: item.image || item.thumbnail || null,
          platforms,
          expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: now,
          sourceSummary: (item.description ?? "").trim(),
        },
        row: {
          source_name: "GamerPower",
          external_id: String(item.id),
          game_id: id,
          instructions: (item.instructions ?? "").trim(),
          offer_url: offerUrl,
          source_url: item.gamerpower_url || "https://www.gamerpower.com/giveaways",
          store_name: detectStore(platforms),
          offer_kind: detectKind(item),
          worth_text: item.worth && item.worth !== "N/A" ? item.worth : null,
          users_count: Math.max(0, Number(item.users ?? 0)),
          published_at: parseDate(item.published_date),
          starts_at: null,
          ends_at: parseDate(item.end_date),
          status: "active" as const,
          last_seen_at: now,
          updated_at: now,
        },
      };
    }));
    prepared.push(...batch.filter((item): item is { seed: GameSeed; row: OfferRow } => item !== null));
  }

  const gameSeeds = prepared.map((item) => item.seed);
  const idMap = await ensureGames(supabase, gameSeeds);
  const rows = prepared.map((item) => ({
    ...item.row,
    game_id: idMap.get(item.row.game_id) ?? item.row.game_id,
  }));
  const result = await syncRows(supabase, "GamerPower", rows, now);
  return {
    ...result,
    enrichmentSeeds: gameSeeds.map((seed) => ({ ...seed, id: idMap.get(seed.id) ?? seed.id })),
  };
}

async function syncEpicGames(supabase: SupabaseClient, now: string): Promise<SyncResult> {
  const response = await fetch(EPIC_PROMOTIONS_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Talus/1.0 (https://pixel-pulse-roan.vercel.app)",
    },
  });
  if (!response.ok) throw new Error(`Epic Games Store returned ${response.status}`);

  const payload = await response.json() as EpicResponse;
  const elements = payload.data?.Catalog?.searchStore?.elements;
  if (!Array.isArray(elements)) throw new Error("Unexpected Epic Games Store response");

  const nowDate = new Date(now);
  const rows: OfferRow[] = [];
  const gameSeeds: GameSeed[] = [];
  const seenPeriods = new Set<string>();

  for (const item of elements) {
    const slug = getEpicSlug(item);
    if (!item.id || !item.title || !slug) continue;

    for (const promotion of getEpicPeriods(item)) {
      if (promotion.discountSetting?.discountPercentage !== 0) continue;
      const startsAt = parseDate(promotion.startDate);
      const endsAt = parseDate(promotion.endDate);
      if (!startsAt || !endsAt || new Date(endsAt) <= nowDate) continue;

      const externalId = `${item.id}:${startsAt}`;
      if (seenPeriods.has(externalId)) continue;
      seenPeriods.add(externalId);

      const offerUrl = `https://store.epicgames.com/en-US/p/${slug}`;
      const imageUrl = getEpicImage(item);
      const name = canonicalGameName(item.title);
      const id = gameSlug(name);
      if (!id) continue;
      gameSeeds.push({
        id,
        slug: id,
        name,
        cover_image: imageUrl,
        platforms: ["PC", "Epic Games Store"],
        expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: now,
        sourceSummary: (item.description ?? "").trim(),
      });
      rows.push({
        source_name: "Epic Games Store",
        external_id: externalId,
        game_id: id,
        instructions: "",
        offer_url: offerUrl,
        source_url: offerUrl,
        store_name: "Epic Games",
        offer_kind: "keep",
        worth_text: item.price?.totalPrice?.fmtPrice?.originalPrice || null,
        users_count: 0,
        published_at: parseDate(item.effectiveDate),
        starts_at: startsAt,
        ends_at: endsAt,
        status: new Date(startsAt) > nowDate ? "upcoming" : "active",
        last_seen_at: now,
        updated_at: now,
      });
    }
  }

  const idMap = await ensureGames(supabase, gameSeeds, true);
  const canonicalRows = rows.map((row) => ({ ...row, game_id: idMap.get(row.game_id) ?? row.game_id }));
  const result = await syncRows(supabase, "Epic Games Store", canonicalRows, now);
  return {
    ...result,
    enrichmentSeeds: gameSeeds.map((seed) => ({ ...seed, id: idMap.get(seed.id) ?? seed.id })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isTrustedServerRequest(req)) return unauthorizedResponse(corsHeaders);
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Supabase environment is incomplete");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const functionCaller = createClient(supabaseUrl, anonKey);
    const now = new Date().toISOString();
    const settled = await Promise.allSettled([
      syncGamerPower(supabase, now),
      syncEpicGames(supabase, now),
    ]);
    const results = settled.map((result, index) => {
      if (result.status === "fulfilled") {
        const { enrichmentSeeds: _enrichmentSeeds, ...publicResult } = result.value;
        return { ok: true, ...publicResult };
      }
      const source = index === 0 ? "GamerPower" : "Epic Games Store";
      console.error(`${source} sync failed`, result.reason);
      return { ok: false, source, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
    });
    const successfulSources = results.filter((result) => result.ok).length;
    const enrichmentSeeds = settled.flatMap((result) => result.status === "fulfilled" ? result.value.enrichmentSeeds : []);
    const descriptions = successfulSources > 0
      ? await enrichMissingGames(supabase, functionCaller, enrichmentSeeds)
      : { attempted: 0, completed: 0 };

    return new Response(
      JSON.stringify({ ok: successfulSources > 0, partial: successfulSources !== results.length, results, descriptions }),
      { status: successfulSources > 0 ? 200 : 500, headers: jsonHeaders },
    );
  } catch (error) {
    console.error("Free Games sync failed", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
