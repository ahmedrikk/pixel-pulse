import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  title: string;
  description: string;
  instructions: string;
  image_url: string | null;
  thumbnail_url: string | null;
  offer_url: string;
  source_url: string;
  store_name: string;
  platforms: string[];
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

async function syncGamerPower(supabase: SupabaseClient, now: string) {
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
  const rows: OfferRow[] = active.map((item) => {
    const platforms = splitPlatforms(item.platforms);
    return {
      source_name: "GamerPower",
      external_id: String(item.id),
      title: normalizeTitle(item.title),
      description: (item.description ?? "").trim(),
      instructions: (item.instructions ?? "").trim(),
      image_url: item.image || item.thumbnail || null,
      thumbnail_url: item.thumbnail || item.image || null,
      offer_url: item.open_giveaway_url || item.open_giveaway || item.gamerpower_url || "https://www.gamerpower.com/giveaways",
      source_url: item.gamerpower_url || "https://www.gamerpower.com/giveaways",
      store_name: detectStore(platforms),
      platforms,
      offer_kind: detectKind(item),
      worth_text: item.worth && item.worth !== "N/A" ? item.worth : null,
      users_count: Math.max(0, Number(item.users ?? 0)),
      published_at: parseDate(item.published_date),
      starts_at: null,
      ends_at: parseDate(item.end_date),
      status: "active",
      last_seen_at: now,
      updated_at: now,
    };
  });

  return syncRows(supabase, "GamerPower", rows, now);
}

async function syncEpicGames(supabase: SupabaseClient, now: string) {
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
      rows.push({
        source_name: "Epic Games Store",
        external_id: externalId,
        title: item.title.trim(),
        description: (item.description ?? "").trim(),
        instructions: "",
        image_url: imageUrl,
        thumbnail_url: imageUrl,
        offer_url: offerUrl,
        source_url: offerUrl,
        store_name: "Epic Games",
        platforms: ["PC", "Epic Games Store"],
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

  return syncRows(supabase, "Epic Games Store", rows, now);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is incomplete");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();
    const settled = await Promise.allSettled([
      syncGamerPower(supabase, now),
      syncEpicGames(supabase, now),
    ]);
    const results = settled.map((result, index) => {
      if (result.status === "fulfilled") return { ok: true, ...result.value };
      const source = index === 0 ? "GamerPower" : "Epic Games Store";
      console.error(`${source} sync failed`, result.reason);
      return { ok: false, source, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
    });
    const successfulSources = results.filter((result) => result.ok).length;

    return new Response(
      JSON.stringify({ ok: successfulSources > 0, partial: successfulSources !== results.length, results }),
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
