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

function twitchNormalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
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
  if (!STEAM_API_KEY) return out;

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
      out.set(twitchNormalize(g.name), idx + 1); // rank 1..100
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
}

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
  const uniqueTags = [...new Set(tags.map(normalizeGameName))].filter(
    (t) => t && ![...existingIds].some((id) => normalizeGameName(id).includes(t) || t.includes(normalizeGameName(id)))
  );

  for (const tag of uniqueTags.slice(0, 10)) {
    const rawg = await searchRawgGame(tag);
    if (!rawg) continue;
    const normRawg = normalizeGameName(rawg.name);
    if (!normRawg) continue;

    // Only insert if it looks related to the tag
    if (!normRawg.includes(tag) && !tag.includes(normRawg)) continue;

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

    // 1. Load cached games
    let { data: games, error: gamesError } = await supabase
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

    // Build a lookup from normalized game name → game id
    let gameByNorm = new Map<string, string>();
    for (const g of games) {
      gameByNorm.set(normalizeGameName(g.name), g.id);
    }

    function findGameIdsForTag(tag: string): string[] {
      const normTag = normalizeGameName(tag);
      if (!normTag) return [];
      const ids: string[] = [];
      for (const [normName, id] of gameByNorm) {
        if (normName === normTag || normName.includes(normTag) || normTag.includes(normName)) {
          ids.push(id);
        }
      }
      return ids;
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
          gameByNorm.set(normalizeGameName(g.name), g.id);
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

    // 4. External signals (run in parallel)
    const [steamScores, twitchRanks, esportsCounts] = await Promise.all([
      fetchSteamScores(games),
      fetchTwitchTopGames(),
      fetchPandaScoreMatches(),
    ]);

    // 5. Build composite scores
    const rows = [];
    for (const g of games) {
      const normName = normalizeGameName(g.name);

      const newsScore = newsByGameId.get(g.id) ?? 0;
      const comm = community.get(g.id);
      const communityScore = comm
        ? (comm.sum / comm.count) * Math.log(comm.count + 1)
        : 0;
      const steamScore = steamScores.get(g.id) ?? 0;
      const twitchRank = twitchRanks.get(normName);
      const twitchScore = twitchRank ? 100 / twitchRank : 0;
      const esportsCount = esportsCounts.get(g.name) ?? 0;
      const esportsScore = esportsCount * 5;
      const rawgScore = (g.rawg_rating ?? 0) * 10 + (g.metacritic_score ?? 0) / 10;
      const releaseScore = getReleaseProximityScore(g.release_date ?? "TBA");

      const composite =
        newsScore * 0.25 +
        steamScore * 0.20 +
        twitchScore * 0.15 +
        esportsScore * 0.10 +
        releaseScore * 0.10 +
        communityScore * 0.12 +
        rawgScore * 0.08;

      rows.push({
        game_id: g.id,
        name: g.name,
        news_score: newsScore,
        steam_score: steamScore,
        twitch_score: twitchScore,
        esports_score: esportsScore,
        community_score: communityScore,
        rawg_score: rawgScore,
        composite_score: composite,
        computed_at: new Date().toISOString(),
      });
    }

    // 6. Persist
    const { error: upsertError } = await supabase
      .from("trending_scores")
      .upsert(rows, { onConflict: "game_id" });
    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ ok: true, count: rows.length }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error("compute-trending failed:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
