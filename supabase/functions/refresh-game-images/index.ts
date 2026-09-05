import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTrustedServerRequest, unauthorizedResponse } from "../_shared/server-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type GameRow = {
  id: string;
  slug: string;
  name: string;
  genres: string[] | null;
  platforms: string[] | null;
  steam_appid: number | null;
};

function placeholderKey(game: GameRow): string {
  const genres = (game.genres ?? []).join(" ").toLowerCase();
  const platforms = (game.platforms ?? []).join(" ").toLowerCase();
  const genresByPriority: Array<[RegExp, string]> = [
    [/horror/, "genre-horror"], [/role.playing|\brpg\b/, "genre-rpg"], [/shooter|\bfps\b|adventure|action/, "genre-action"],
    [/strategy|simulation|puzzle/, "genre-strategy"], [/sport|racing/, "genre-sports"],
  ];
  for (const [pattern, key] of genresByPriority) if (pattern.test(genres)) return key;
  if (/playstation|\bps[345]\b/.test(platforms)) return "platform-playstation";
  if (/xbox/.test(platforms)) return "platform-xbox";
  if (/switch|nintendo/.test(platforms)) return "platform-nintendo";
  if (/\bpc\b|windows|linux|mac/.test(platforms)) return "platform-pc";
  return "generic";
}

async function igdbImage(game: GameRow): Promise<string | null> {
  const clientId = Deno.env.get("IGDB_CLIENT_ID");
  const clientSecret = Deno.env.get("IGDB_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`, { method: "POST" });
  if (!tokenResponse.ok) return null;
  const token = (await tokenResponse.json()).access_token as string | undefined;
  if (!token) return null;
  const escapedName = game.name.replace(/["\\]/g, " ");
  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": clientId, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: `search "${escapedName}"; fields cover.image_id; where cover != null; limit 1;`,
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ cover?: { image_id?: string } }>;
  const imageId = rows[0]?.cover?.image_id;
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg` : null;
}

async function rawgImage(game: GameRow): Promise<string | null> {
  const apiKey = Deno.env.get("RAWG_API_KEY");
  if (!apiKey) return null;
  const response = await fetch(`https://api.rawg.io/api/games/${encodeURIComponent(game.slug)}?key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) return null;
  const data = await response.json() as { background_image?: string | null };
  return data.background_image ?? null;
}

async function steamImage(game: GameRow): Promise<string | null> {
  if (!game.steam_appid) return null;
  const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.steam_appid}&cc=us&l=en`);
  if (!response.ok) return null;
  const payload = await response.json() as Record<string, { success?: boolean; data?: { header_image?: string } }>;
  return payload[String(game.steam_appid)]?.data?.header_image ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isTrustedServerRequest(req)) return unauthorizedResponse(corsHeaders);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("games")
      .select("id, slug, name, genres, platforms, steam_appid")
      .in("image_status", ["placeholder", "missing"])
      .or(`image_checked_at.is.null,image_checked_at.lt.${cutoff}`)
      .order("trending", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(40);
    if (error) throw error;

    let refreshed = 0;
    let placeholders = 0;
    for (const game of (data ?? []) as GameRow[]) {
      let image: string | null = null;
      let source: "igdb" | "rawg" | "steam" | "placeholder" = "placeholder";
      try { image = await igdbImage(game); if (image) source = "igdb"; } catch (error) { console.warn("IGDB lookup failed", game.id, error); }
      if (!image) try { image = await rawgImage(game); if (image) source = "rawg"; } catch (error) { console.warn("RAWG lookup failed", game.id, error); }
      if (!image) try { image = await steamImage(game); if (image) source = "steam"; } catch (error) { console.warn("Steam lookup failed", game.id, error); }
      const key = placeholderKey(game);
      const update = image
        ? { cover_image: image, image_source: source, image_status: "real", image_placeholder_key: null, image_checked_at: new Date().toISOString() }
        : { cover_image: `/game-placeholders/${key}.svg`, image_source: "placeholder", image_status: "placeholder", image_placeholder_key: key, image_checked_at: new Date().toISOString() };
      const { error: updateError } = await supabase.from("games").update(update).eq("id", game.id);
      if (updateError) throw updateError;
      if (image) refreshed += 1; else placeholders += 1;
    }
    return new Response(JSON.stringify({ ok: true, checked: data?.length ?? 0, refreshed, placeholders }), { headers: jsonHeaders });
  } catch (error) {
    console.error("Game image refresh failed", error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: jsonHeaders });
  }
});
