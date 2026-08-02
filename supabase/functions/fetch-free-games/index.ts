import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const GIVEAWAYS_URL = "https://www.gamerpower.com/api/giveaways?type=game&sort-by=date";

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

function isLowFrictionGameOffer(item: GamerPowerGiveaway): boolean {
  const content = `${item.title} ${item.instructions ?? ""}`.toLowerCase();
  return !/\bkey\b|gleam|survey|newsletter|whitelist|join (?:our|the) discord|follow (?:us|the)/i.test(content);
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

    const response = await fetch(GIVEAWAYS_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Talus/1.0 (https://pixel-pulse-roan.vercel.app)",
      },
    });
    if (!response.ok) throw new Error(`GamerPower returned ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error("Unexpected GamerPower response");

    const now = new Date().toISOString();
    const active = (payload as GamerPowerGiveaway[]).filter((item) =>
      item.id && item.title && item.status?.toLowerCase() === "active" && isLowFrictionGameOffer(item)
    );
    const rows = active.map((item) => {
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
        ends_at: parseDate(item.end_date),
        status: "active",
        last_seen_at: now,
        updated_at: now,
      };
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("free_game_offers")
        .upsert(rows, { onConflict: "source_name,external_id" });
      if (upsertError) throw upsertError;
    }

    const activeIds = rows.map((row) => row.external_id);
    let expireQuery = supabase
      .from("free_game_offers")
      .update({ status: "expired", updated_at: now })
      .eq("source_name", "GamerPower")
      .eq("status", "active");
    if (activeIds.length > 0) expireQuery = expireQuery.not("external_id", "in", `(${activeIds.join(",")})`);
    const { error: expireError } = await expireQuery;
    if (expireError) throw expireError;

    return new Response(JSON.stringify({ ok: true, fetched: payload.length, active: rows.length }), { headers: jsonHeaders });
  } catch (error) {
    console.error("Free Games sync failed", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
