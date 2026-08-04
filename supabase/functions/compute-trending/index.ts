import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const NEWS_WINDOW_DAYS = 7;
const PANDA_DAYS_AHEAD = 7;
const STEAM_API_KEY = Deno.env.get("STEAM_API_KEY") ?? Deno.env.get("VITE_STEAM_API_KEY") ?? "";
const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? "";
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET") ?? "";
const PANDASCORE_API_KEY = Deno.env.get("PANDASCORE_API_KEY") ?? Deno.env.get("VITE_PANDASCORE_API_KEY") ?? "";
const RAWG_API_KEY = Deno.env.get("RAWG_API_KEY") ?? Deno.env.get("VITE_RAWG_API_KEY") ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");
}

// Convert a trailing roman numeral to arabic ("granttheftautovi" → "...6") so
// news tags like "Diablo 4" can match a game named "Diablo IV" without
// resorting to substring matching (which let "Diablo" (1996) absorb all of
// Diablo IV's news and Steam signals).
const ROMAN_MAP: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5",
  vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
};

function arabicizeTrailingRoman(original: string): string {
  // Require a separator before the numeral so "Xbox" / "Muv-Luv" don't get
  // their trailing letters misread as roman numerals.
  const m = original.trim().match(/^(.*?)[\s:\-–—]+(i{1,3}|iv|v|vi{1,3}|ix|x)$/i);
  if (m) {
    const roman = m[2].toLowerCase();
    if (ROMAN_MAP[roman]) return normalizeGameName(m[1]) + ROMAN_MAP[roman];
  }
  return normalizeGameName(original);
}

// Common community abbreviations → canonical normalized names.
const NAME_ALIASES: Record<string, string> = {
  gta6: "grandtheftauto6",
  gtavi: "grandtheftauto6",
  gta5: "grandtheftauto5",
  gtav: "grandtheftauto5",
  cs2: "counterstrike2",
  tes6: "theelderscrolls6",
  elderscrolls6: "theelderscrolls6",
  elderscrollsvi: "theelderscrolls6",
  cod: "callofduty",
  poe2: "pathofexile2",
};

/** Canonical form used for all game-name comparisons. */
function canonicalGameName(name: string): string {
  const norm = arabicizeTrailingRoman(name);
  return NAME_ALIASES[norm] ?? norm;
}

function daysAgo(date: string): number {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

function getReleaseProximityScore(releaseDateStr: string): number {
  if (!releaseDateStr || releaseDateStr === "TBA") return 0;
  const parsed = Date.parse(releaseDateStr);
  if (isNaN(parsed)) return 0;

  const release = new Date(parsed);
  const now = new Date();
  const daysUntil = Math.round((release.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntil < -30) return 0;
  if (daysUntil < 0) return Math.round((1 - Math.abs(daysUntil) / 30) * 100);
  if (daysUntil <= 7) return 100;
  if (daysUntil <= 30) return Math.round((1 - (daysUntil - 7) / 23) * 80 + 20);
  if (daysUntil <= 90) return Math.round((1 - (daysUntil - 30) / 60) * 15);
  return 0;
}

async function withConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Steam player counts
// ---------------------------------------------------------------------------
/** Search the Steam store for a game's app id. Returns 0 if not on Steam. */
async function searchSteamAppId(name: string): Promise<number> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=english&cc=US`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const items = (data.items ?? []) as { id: number; name: string }[];
    const best = items[0];
    if (!best) return 0;
    // Only trust the match when the names actually overlap, otherwise the
    // store search happily returns unrelated games/DLC.
    // Exact canonical match only — substring matching gave the 1996 "Diablo"
    // Diablo IV's app id (and player counts).
    if (canonicalGameName(best.name) !== canonicalGameName(name)) return 0;
    return best.id;
  } catch {
    return 0;
  }
}

/**
 * Resolve steam_appid for cached games that have never been looked up
 * (steam_appid null). Persists the result — 0 means "known not on Steam" —
 * so each game is only searched once.
 */
async function resolveMissingSteamAppIds(
  supabase: ReturnType<typeof createClient>,
  games: { id: string; name: string; steam_appid: number | null }[]
): Promise<void> {
  const unresolved = games.filter((g) => g.steam_appid === null).slice(0, 30);
  await withConcurrency(unresolved, async (g) => {
    const appid = await searchSteamAppId(g.name);
    g.steam_appid = appid;
    try {
      await supabase.from("games").update({ steam_appid: appid }).eq("id", g.id);
    } catch {
      // ignore write failures; we'll retry next run
    }
  }, 5);
}

async function fetchSteamPlayerCount(appid: number): Promise<number> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`,
      { method: "GET" }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.response?.player_count ?? 0;
  } catch {
    return 0;
  }
}

async function fetchSteamScores(
  games: { id: string; steam_appid: number | null; name: string }[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  // Steam concurrent player counts are FREE — no API key required.
  const withAppid = games.filter((g) => g.steam_appid);
  await withConcurrency(withAppid, async (g) => {
    const count = await fetchSteamPlayerCount(g.steam_appid!);
    // Log-scale so mega-hits like CS2 don't drown everything else.
    const score = Math.log10(count + 1);
    out.set(g.id, score);
  }, 5);

  return out;
}

// ---------------------------------------------------------------------------
// Twitch top games (rank-based signal)
// ---------------------------------------------------------------------------
interface TwitchToken {
  access_token: string;
  expires_in: number;
}

async function getTwitchToken(): Promise<string | null> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!res.ok) return null;
    const data: TwitchToken = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchTwitchTopGames(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const token = await getTwitchToken();
  if (!token) return out;

  try {
    const res = await fetch(
      "https://api.twitch.tv/helix/games/top?first=100",
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      }
    );
    if (!res.ok) return out;
    const data = await res.json();
    const games = (data.data ?? []) as { name: string }[];
    games.forEach((g, idx) => {
      out.set(canonicalGameName(g.name), idx + 1); // rank 1..100
    });
  } catch {
    // ignore
  }
  return out;
}

// ---------------------------------------------------------------------------
// RAWG enrichment for news tags that aren't in our games cache yet
// ---------------------------------------------------------------------------
interface RawgGame {
  slug: string;
  name: string;
  background_image: string | null;
  rating: number;
  metacritic: number | null;
  released: string | null;
  added: number;
}

// News game_tags that are platforms/companies/generic terms, not games.
// Never create games for these and never let them appear as trending rows.
const NON_GAME_TAGS = new Set([
  "xbox", "playstation", "ps5", "ps4", "nintendo", "nintendoswitch", "switch",
  "steam", "steamdeck", "pc", "sony", "microsoft", "epicgames", "gamepass",
  "xboxgamepass", "esports", "gaming", "videogames", "twitch", "ea", "ubisoft",
]);

async function searchRawgGame(name: string): Promise<RawgGame | null> {
  if (!RAWG_API_KEY) return null;
  try {
    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", RAWG_API_KEY);
    url.searchParams.set("search", name);
    url.searchParams.set("page_size", "1");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results ?? []) as RawgGame[];
    return results[0] ?? null;
  } catch {
    return null;
  }
}

async function ensureGamesForNewsTags(
  supabase: ReturnType<typeof createClient>,
  tags: string[],
  existingIds: Set<string>
): Promise<void> {
  if (!RAWG_API_KEY) return;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const existingCanon = new Set([...existingIds].map(canonicalGameName));
  const uniqueTags = [...new Set(tags.map(canonicalGameName))].filter(
    (t) => t && !NON_GAME_TAGS.has(t) && !existingCanon.has(t)
  );

  for (const tag of uniqueTags.slice(0, 10)) {
    const rawg = await searchRawgGame(tag);
    if (!rawg) continue;
    const normRawg = canonicalGameName(rawg.name);
    if (!normRawg || NON_GAME_TAGS.has(normRawg)) continue;

    // Only insert when RAWG's top hit is the same game as the tag
    // (canonical match handles "gta6" → "Grand Theft Auto VI").
    if (normRawg !== tag) continue;

    // Require some RAWG popularity so obscure shovelware that happens to
    // match a news tag doesn't enter the catalog. Big unreleased titles
    // (GTA VI) have huge "added" counts, so this doesn't exclude them.
    if ((rawg.added ?? 0) < 50) continue;

    try {
      await supabase.from("games").upsert(
        {
          id: rawg.slug,
          name: rawg.name,
          slug: rawg.slug,
          cover_image: rawg.background_image ?? "",
          rawg_rating: Math.round(rawg.rating * 10) / 10,
          metacritic_score: rawg.metacritic ?? null,
          release_date: rawg.released ?? "TBA",
          expires_at: expiresAt,
        },
        { onConflict: "id" }
      );
    } catch {
      // ignore individual write failures
    }
  }
}

// ---------------------------------------------------------------------------
// PandaScore upcoming matches per game
// ---------------------------------------------------------------------------
async function fetchPandaScoreMatches(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!PANDASCORE_API_KEY) return out;

  const now = new Date().toISOString();
  const future = new Date(Date.now() + PANDA_DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString();

  try {
    const url = new URL("https://api.pandascore.co/matches/upcoming");
    url.searchParams.set("page[size]", "100");
    url.searchParams.set("range[begin_at]", `${now},${future}`);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${PANDASCORE_API_KEY}` },
    });
    if (!res.ok) return out;
    const data = await res.json();
    const matches = (Array.isArray(data) ? data : []) as {
      videogame?: { name?: string };
    }[];

    for (const m of matches) {
      const name = m.videogame?.name;
      if (!name) continue;
      out.set(name, (out.get(name) ?? 0) + 1);
    }
  } catch {
    // ignore
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newsControl } = await supabase
      .from("operational_controls")
      .select("enabled, reason, updated_at")
      .eq("key", "news_updates")
      .maybeSingle();
    if (newsControl?.enabled === false) {
      return new Response(JSON.stringify({
        ok: true,
        paused: true,
        reason: newsControl.reason,
        pausedAt: newsControl.updated_at,
      }), { headers: JSON_HEADERS });
    }

    // 1. Load cached games
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, name, steam_appid, rawg_rating, metacritic_score, release_date, cover_image");
    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), { headers: JSON_HEADERS });
    }

    // 2. News mentions (last N days), time-decayed
    const since = new Date(
      Date.now() - NEWS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: articles, error: articlesError } = await supabase
      .from("cached_articles")
      .select("game_tags, article_date")
      .gte("article_date", since);
    if (articlesError) throw articlesError;

    // Build a lookup from canonical game name → game id
    let gameByNorm = new Map<string, string>();
    for (const g of games) {
      gameByNorm.set(canonicalGameName(g.name), g.id);
    }

    // Exact canonical match only. Substring matching let short names absorb
    // signals from their sequels ("Diablo" ← "Diablo 4" news). Unmatched
    // sequels get added to the games cache by ensureGamesForNewsTags instead.
    function findGameIdsForTag(tag: string): string[] {
      const canon = canonicalGameName(tag);
      if (!canon) return [];
      const id = gameByNorm.get(canon);
      return id ? [id] : [];
    }

    // Enrich games cache for hot news tags that aren't cached yet (e.g. GTA VI).
    const allTags = (articles ?? []).flatMap((a) => a.game_tags ?? []);
    const unmatchedTags = allTags.filter((t) => findGameIdsForTag(t).length === 0);
    if (unmatchedTags.length > 0) {
      await ensureGamesForNewsTags(supabase, unmatchedTags, new Set(games.map((g) => g.id)));
      // Reload games so new entries participate in scoring.
      const { data: refreshedGames, error: refreshError } = await supabase
        .from("games")
        .select("id, name, steam_appid, rawg_rating, metacritic_score, release_date, cover_image");
      if (!refreshError && refreshedGames && refreshedGames.length > games.length) {
        games = refreshedGames;
        gameByNorm = new Map<string, string>();
        for (const g of games) {
          gameByNorm.set(canonicalGameName(g.name), g.id);
        }
      }
    }

    const newsByGameId = new Map<string, number>();
    for (const article of articles ?? []) {
      const days = daysAgo(article.article_date);
      const decay = Math.max(0.15, 1 - days / NEWS_WINDOW_DAYS);
      const seenTags = new Set<string>();
      for (const tag of article.game_tags ?? []) {
        // One mention per article per game, even if multiple tags map to it.
        for (const gameId of findGameIdsForTag(tag)) {
          if (seenTags.has(gameId)) continue;
          seenTags.add(gameId);
          newsByGameId.set(gameId, (newsByGameId.get(gameId) ?? 0) + decay);
        }
      }
    }

    // 3. Community reviews
    const { data: reviews, error: reviewsError } = await supabase
      .from("user_game_reviews")
      .select("game_id, star_rating");
    if (reviewsError) throw reviewsError;

    const community = new Map<string, { sum: number; count: number }>();
    for (const r of reviews ?? []) {
      const e = community.get(r.game_id) ?? { sum: 0, count: 0 };
      e.sum += r.star_rating;
      e.count += 1;
      community.set(r.game_id, e);
    }

    // 4. External signals. Resolve missing Steam app ids first (persisted,
    // so each game is only searched once), then fetch everything in parallel.
    await resolveMissingSteamAppIds(supabase, games);
    const [steamScores, twitchRanks, esportsCounts] = await Promise.all([
      fetchSteamScores(games),
      fetchTwitchTopGames(),
      fetchPandaScoreMatches(),
    ]);

    // 5. Compute raw signals per game.
    const runStartedAt = new Date().toISOString();
    const raw = [];
    for (const g of games) {
      const normName = canonicalGameName(g.name);
      // Platforms/companies that slipped into the games cache are not games.
      if (NON_GAME_TAGS.has(normName)) continue;

      const comm = community.get(g.id);
      const twitchRank = twitchRanks.get(normName);
      raw.push({
        g,
        newsScore: newsByGameId.get(g.id) ?? 0,
        communityScore: comm
          ? (comm.sum / comm.count) * Math.log(comm.count + 1)
          : 0,
        steamScore: steamScores.get(g.id) ?? 0,
        twitchScore: twitchRank ? 100 / twitchRank : 0,
        esportsScore: (esportsCounts.get(g.name) ?? 0) * 5,
        rawgScore: (g.rawg_rating ?? 0) * 10 + (g.metacritic_score ?? 0) / 10,
        releaseScore: getReleaseProximityScore(g.release_date ?? "TBA"),
      });
    }

    // 6. Composite: raw signal values are stored per-column (the frontend
    // formats them), but each signal is normalized to 0–100 before weighting
    // so the weights reflect real influence — otherwise the static RAWG score
    // (0–60) drowns out live signals like time-decayed news buzz (0–5).
    const norm = (v: number, max: number) =>
      max > 0 ? Math.min((v / max) * 100, 100) : 0;
    const maxNews = Math.max(...raw.map((r) => r.newsScore), 0);
    const maxSteam = Math.max(...raw.map((r) => r.steamScore), 0);
    const maxCommunity = Math.max(...raw.map((r) => r.communityScore), 0);

    const rows = raw.map((r) => ({
      game_id: r.g.id,
      name: r.g.name,
      news_score: r.newsScore,
      steam_score: r.steamScore,
      twitch_score: r.twitchScore,
      esports_score: r.esportsScore,
      community_score: r.communityScore,
      rawg_score: r.rawgScore,
      release_proximity_score: r.releaseScore,
      composite_score:
        norm(r.newsScore, maxNews) * 0.22 +
        norm(r.steamScore, maxSteam) * 0.18 +
        r.twitchScore * 0.15 + // 100/rank is already 0–100
        Math.min(r.esportsScore, 100) * 0.10 +
        r.releaseScore * 0.15 + // already 0–100
        norm(r.communityScore, maxCommunity) * 0.12 +
        norm(r.rawgScore, 60) * 0.08,
      computed_at: runStartedAt,
    }));

    // 7. Persist, then drop rows this run no longer produced (expired cache
    // entries, junk tags) so stale games can't linger in the trending list.
    const { error: upsertError } = await supabase
      .from("trending_scores")
      .upsert(rows, { onConflict: "game_id" });
    if (upsertError) {
      console.error("upsert error:", upsertError);
      throw upsertError;
    }
    const { error: cleanupError } = await supabase
      .from("trending_scores")
      .delete()
      .lt("computed_at", runStartedAt);
    if (cleanupError) {
      console.error("stale-row cleanup error:", cleanupError);
    }

    return new Response(
      JSON.stringify({ ok: true, count: rows.length }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    const errorBody = err instanceof Error
      ? { message: err.message, stack: err.stack, cause: err.cause }
      : err;
    console.error("compute-trending failed:", errorBody);
    return new Response(
      JSON.stringify({ error: errorBody }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
