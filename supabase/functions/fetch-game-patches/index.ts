import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const STEAM_NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/";
const MAX_CONTENT_LENGTH = 20_000;
const SCHEDULED_SOURCE_BATCH_SIZE = 24;
const SOURCE_SYNC_CONCURRENCY = 4;
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

interface CanonicalSteamGame {
  id: string;
  steam_appid: number | null;
}

async function ensureCanonicalPatchSources(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const { data, error } = await supabase
    .from("games")
    .select("id, steam_appid")
    .gt("steam_appid", 0)
    .limit(1_000);
  if (error) throw new Error(`Unable to discover Steam-backed games: ${error.message}`);

  // One Steam app may have duplicate/legacy Game rows. Prefer a readable
  // canonical slug over a numeric import id, then keep the shortest stable id.
  const canonicalByAppId = new Map<number, CanonicalSteamGame>();
  for (const game of (data ?? []) as CanonicalSteamGame[]) {
    const appId = Number(game.steam_appid);
    if (!Number.isInteger(appId) || appId <= 0) continue;
    const current = canonicalByAppId.get(appId);
    const candidateIsSlug = !/^\d+$/.test(game.id);
    const currentIsSlug = current ? !/^\d+$/.test(current.id) : false;
    if (!current
      || (candidateIsSlug && !currentIsSlug)
      || (candidateIsSlug === currentIsSlug && game.id.length < current.id.length)) {
      canonicalByAppId.set(appId, game);
    }
  }

  const rows = [...canonicalByAppId.entries()].map(([appId, game]) => ({
    id: `steam-${appId}`,
    game_id: game.id,
    steam_appid: appId,
    source_name: "Steam Community Announcements",
    active: true,
    poll_interval_minutes: 60,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return 0;

  // ignoreDuplicates preserves an already-established canonical game link,
  // while registering every newly-discovered Steam-backed title.
  const { error: sourceError } = await supabase
    .from("game_patch_sources")
    .upsert(rows, { onConflict: "steam_appid", ignoreDuplicates: true });
  if (sourceError) throw new Error(`Unable to register patch sources: ${sourceError.message}`);
  return rows.length;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      () => runWorker(),
    ),
  );
  return results;
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
      source_title: stripMarkup(item.title).slice(0, 500),
      source_content: contentText,
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
  const { data, error } = await supabase.rpc("ingest_game_patch_sources", {
    source_rows: patches,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? patches.length);
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
    const eligibleGameCount = await ensureCanonicalPatchSources(supabase);

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
      const explicitSourceRequest = Boolean(body.sourceId || body.gameId);
      const batchSize = mode === "backfill" && !explicitSourceRequest
        ? 4
        : SCHEDULED_SOURCE_BATCH_SIZE;
      const selectedSources = sources.slice(0, explicitSourceRequest ? sources.length : batchSize);
      results.push(...await mapWithConcurrency(
        selectedSources,
        mode === "backfill" ? 2 : SOURCE_SYNC_CONCURRENCY,
        (source) => syncSource(supabase, source, mode, mode === "refresh" ? 1 : pages),
      ));
    } else {
      // The registry can contain hundreds of games. Select the oldest-due
      // bounded batch on each run; last_polled_at moves completed games to the
      // back, so every source receives fair coverage over successive crons.
      const dueSources = sources.filter((source) => {
        const dueAfterMs = Math.max(1, source.poll_interval_minutes - 1) * 60_000;
        return !source.last_polled_at
          || Date.now() - new Date(source.last_polled_at).getTime() >= dueAfterMs;
      });
      const refreshBatch = dueSources.slice(0, SCHEDULED_SOURCE_BATCH_SIZE);
      results.push(...await mapWithConcurrency(
        refreshBatch,
        SOURCE_SYNC_CONCURRENCY,
        (source) => syncSource(supabase, source, "refresh", 1),
      ));
      const backfillSource = sources
        .filter((source) => !refreshBatch.some((selected) => selected.id === source.id))
        .filter((source) => !source.backfill_complete)
        .sort((a, b) => (a.backfill_cursor ?? Number.MAX_SAFE_INTEGER) - (b.backfill_cursor ?? Number.MAX_SAFE_INTEGER))[0];
      if (backfillSource) results.push(await syncSource(supabase, backfillSource, "backfill", 2));

      console.log(
        `Patch source rotation: ${refreshBatch.length}/${sources.length} selected, `
        + `${Math.max(0, dueSources.length - refreshBatch.length)} due sources remain`,
      );
    }

    return new Response(JSON.stringify({
      ok: results.every((result) => !result.error),
      mode,
      eligibleGameCount,
      sourceCount: sources.length,
      selectedSourceCount: results.length,
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
