import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const STEAM_NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/";
const MAX_CONTENT_LENGTH = 20_000;
const PATCH_TITLE_PATTERN = /\b(patch(?:\s+notes?)?|hotfix|update(?:\s+notes?)?|changelog|release\s+notes?|maintenance|balance\s+(?:update|changes?)|version\s+\d+(?:\.\d+)*|v\d+(?:\.\d+)+|\d+\.\d+(?:\.\d+){1,4})\b/i;
const STRONG_PATCH_PATTERN = /\b(patch(?:\s+notes?)?|hotfix|changelog|release\s+notes?|maintenance|balance\s+(?:update|changes?))\b/i;
const NON_PATCH_UPDATE_PATTERN = /\b(store|shop|marketplace|sale|bundle|cosmetic|appearance|esports|tournament|community|developer|devstream|workshop|roadmap|release\s+schedule|specifications)\b/i;
const UPCOMING_PATCH_PATTERN = /\b(stress test|register now|hotfix incoming|patch incoming)\b/i;

interface PatchSource {
  id: string;
  game_id: string;
  steam_appid: number;
  source_name: string;
  poll_interval_minutes: number;
  last_polled_at: string | null;
  backfill_cursor: number | null;
  backfill_complete: boolean;
}

interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  is_external_url?: boolean;
  author?: string;
  contents?: string;
  feedlabel?: string;
  feedname?: string;
  date: number;
}

interface SteamNewsResponse {
  appnews?: {
    appid: number;
    newsitems?: SteamNewsItem[];
  };
}

interface SyncResult {
  sourceId: string;
  gameId: string;
  fetched: number;
  matched: number;
  stored: number;
  oldestTimestamp: number | null;
  complete: boolean;
  error: string | null;
}

function decodeEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function stripMarkup(value: string): string {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{STEAM_CLAN_IMAGE\}\/\S+/gi, " ")
    .replace(/\[(?:img|url|video|previewyoutube)[^\]]*\][\s\S]*?\[\/(?:img|url|video|previewyoutube)\]/gi, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarize(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 520) return compact;
  const excerpt = compact.slice(0, 520);
  const sentenceEnd = Math.max(excerpt.lastIndexOf(". "), excerpt.lastIndexOf("! "), excerpt.lastIndexOf("? "));
  return `${excerpt.slice(0, sentenceEnd > 260 ? sentenceEnd + 1 : 500).trim()}…`;
}

function classifyPatch(title: string): "patch" | "hotfix" | "balance" | "maintenance" | "update" {
  if (/hotfix/i.test(title)) return "hotfix";
  if (/balance/i.test(title)) return "balance";
  if (/maintenance/i.test(title)) return "maintenance";
  if (/patch/i.test(title)) return "patch";
  return "update";
}

function versionFromTitle(title: string): string | null {
  const match = title.match(/(?:version|patch|update|v)\s*#?([0-9]+(?:\.[0-9a-z]+){0,5})/i);
  return match?.[1] ? `v${match[1]}` : null;
}

function isPatchCandidate(item: SteamNewsItem): boolean {
  if (item.feedname !== "steam_community_announcements" || !PATCH_TITLE_PATTERN.test(item.title)) {
    return false;
  }
  if (UPCOMING_PATCH_PATTERN.test(item.title)) {
    return false;
  }
  return STRONG_PATCH_PATTERN.test(item.title) || !NON_PATCH_UPDATE_PATTERN.test(item.title);
}

async function fetchSteamPage(
  source: PatchSource,
  endDate?: number,
  pageSize = 100,
): Promise<SteamNewsItem[]> {
  const params = new URLSearchParams({
    appid: String(source.steam_appid),
    count: String(pageSize),
    maxlength: String(MAX_CONTENT_LENGTH),
    format: "json",
    feeds: "steam_community_announcements",
  });
  if (endDate) params.set("enddate", String(endDate));

  const response = await fetch(`${STEAM_NEWS_URL}?${params}`, {
    headers: { "User-Agent": "TalusGamePatch/1.0 (+https://pixel-pulse-roan.vercel.app)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Steam returned HTTP ${response.status}`);
  const payload = await response.json() as SteamNewsResponse;
  return payload.appnews?.newsitems ?? [];
}

async function storeItems(
  supabase: ReturnType<typeof createClient>,
  source: PatchSource,
  items: SteamNewsItem[],
): Promise<number> {
  const patches = items.filter(isPatchCandidate).map((item) => {
    const contentText = stripMarkup(item.contents ?? "").slice(0, MAX_CONTENT_LENGTH);
    return {
      game_id: source.game_id,
      source_id: source.id,
      external_id: item.gid,
      title: stripMarkup(item.title).slice(0, 500),
      summary: summarize(contentText),
      content_text: contentText,
      source_url: item.url,
      source_name: source.source_name,
      patch_type: classifyPatch(item.title),
      version_label: versionFromTitle(item.title),
      image_url: `https://cdn.akamai.steamstatic.com/steam/apps/${source.steam_appid}/header.jpg`,
      published_at: new Date(item.date * 1000).toISOString(),
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  if (patches.length === 0) return 0;
  const { error } = await supabase
    .from("game_patches")
    .upsert(patches, { onConflict: "source_id,external_id" });
  if (error) throw new Error(error.message);
  return patches.length;
}

async function syncSource(
  supabase: ReturnType<typeof createClient>,
  source: PatchSource,
  mode: "refresh" | "backfill",
  pages: number,
): Promise<SyncResult> {
  const result: SyncResult = {
    sourceId: source.id,
    gameId: source.game_id,
    fetched: 0,
    matched: 0,
    stored: 0,
    oldestTimestamp: null,
    complete: false,
    error: null,
  };

  try {
    const pageSize = mode === "refresh" ? 40 : 100;
    let cursor = mode === "backfill" ? source.backfill_cursor ?? undefined : undefined;

    for (let page = 0; page < pages; page += 1) {
      const items = await fetchSteamPage(source, cursor, pageSize);
      result.fetched += items.length;
      result.matched += items.filter(isPatchCandidate).length;
      result.stored += await storeItems(supabase, source, items);

      if (items.length === 0) {
        result.complete = true;
        break;
      }

      const oldest = Math.min(...items.map((item) => item.date));
      result.oldestTimestamp = result.oldestTimestamp == null
        ? oldest
        : Math.min(result.oldestTimestamp, oldest);
      cursor = oldest - 1;

      if (items.length < pageSize || mode === "refresh") {
        result.complete = items.length < pageSize;
        break;
      }
    }

    const now = new Date().toISOString();
    const update = mode === "refresh"
      ? { last_polled_at: now, updated_at: now }
      : {
          backfill_cursor: result.oldestTimestamp == null
            ? source.backfill_cursor
            : result.oldestTimestamp - 1,
          backfill_complete: result.complete,
          oldest_synced_at: result.oldestTimestamp == null
            ? null
            : new Date(result.oldestTimestamp * 1000).toISOString(),
          updated_at: now,
        };
    const { error: updateError } = await supabase
      .from("game_patch_sources")
      .update(update)
      .eq("id", source.id);
    if (updateError) throw new Error(updateError.message);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "fetch-game-patches" }), {
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase service credentials are missing");
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({})) as {
      mode?: "scheduled" | "refresh" | "backfill";
      sourceId?: string;
      gameId?: string;
      pages?: number;
    };
    const mode = body.mode ?? "scheduled";
    const pages = Math.min(Math.max(body.pages ?? 5, 1), 10);

    let query = supabase
      .from("game_patch_sources")
      .select("id, game_id, steam_appid, source_name, poll_interval_minutes, last_polled_at, backfill_cursor, backfill_complete")
      .eq("active", true);
    if (body.sourceId) query = query.eq("id", body.sourceId);
    if (body.gameId) query = query.eq("game_id", body.gameId);

    const { data, error } = await query.order("last_polled_at", { ascending: true, nullsFirst: true });
    if (error) throw new Error(error.message);
    const sources = (data ?? []) as PatchSource[];
    if (sources.length === 0) {
      return new Response(JSON.stringify({ ok: true, results: [], message: "No matching sources" }), {
        headers: jsonHeaders,
      });
    }

    const results: SyncResult[] = [];
    if (mode === "refresh" || mode === "backfill") {
      for (const source of sources.slice(0, 24)) {
        results.push(await syncSource(supabase, source, mode, mode === "refresh" ? 1 : pages));
      }
    } else {
      // Refresh every supported game, then advance two pages of history for the
      // least-complete source. This keeps recent patches fast while building a
      // permanent archive in the background.
      for (const source of sources.slice(0, 24)) {
        const due = !source.last_polled_at
          || Date.now() - new Date(source.last_polled_at).getTime()
            >= source.poll_interval_minutes * 60_000;
        if (due) results.push(await syncSource(supabase, source, "refresh", 1));
      }
      const backfillSource = sources
        .filter((source) => !source.backfill_complete)
        .sort((a, b) => (a.backfill_cursor ?? Number.MAX_SAFE_INTEGER) - (b.backfill_cursor ?? Number.MAX_SAFE_INTEGER))[0];
      if (backfillSource) results.push(await syncSource(supabase, backfillSource, "backfill", 2));
    }

    return new Response(JSON.stringify({
      ok: results.every((result) => !result.error),
      mode,
      sourceCount: sources.length,
      fetched: results.reduce((total, result) => total + result.fetched, 0),
      stored: results.reduce((total, result) => total + result.stored, 0),
      results,
    }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: jsonHeaders });
  }
});
