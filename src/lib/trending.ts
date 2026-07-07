// src/lib/trending.ts
// Multi-signal trending engine: Steam players, news buzz, release proximity,
// community activity, and RAWG ratings combined into a single trending score.

import { supabase } from "@/integrations/supabase/client";

// ── Hard-coded Steam App ID map for well-known games (fallback / override) ──
const KNOWN_STEAM_IDS: Record<string, number> = {
  "counter-strike-2": 730,
  "counter-strike-2-season-2": 730,
  "cs2": 730,
  "elden-ring": 1245620,
  "elden-ring-dlc": 1245620,
  "elden-ring-shadow-of-the-erdtree": 1245620,
  "grand-theft-auto-v": 271590,
  "gta-v": 271590,
  "monster-hunter-wilds": 2246340,
  "monster-hunter-wilds": 2246340,
  "call-of-duty": 1938090,
  "call-of-duty-2025": 1938090,
  "valorant": 0,               // not on Steam (Riot launcher)
  "valorant-episode-9": 0,
  "league-of-legends": 0,      // not on Steam
  "fortnite": 0,               // not on Steam (Epic)
  "overwatch-2": 0,            // not on Steam (Battle.net)
  "apex-legends": 1172470,
  "dota-2": 570,
  "pubg": 578080,
  "team-fortress-2": 440,
  "rust": 252490,
  "destiny-2": 1085660,
  "rainbow-six-siege": 359550,
  "rocket-league": 252950,
  "warframe": 230410,
  "path-of-exile-2": 2694490,
  "path-of-exile": 238960,
  "civilization-vii": 3160530,
  "civilization-7": 3160530,
  "civ-7": 3160530,
  "forza-horizon-5": 1551360,
  "forza-horizon-6": 0,        // not released yet
  "ea-sports-fc-24": 2195250,
  "ea-sports-fc-25": 2666510,
  "ea-sports-fc-26": 0,        // not released yet
  "hogwarts-legacy": 990080,
  "baldurs-gate-3": 1086940,
  "palworld": 1623730,
  "helldivers-2": 553850,
  "ghost-of-tsushima": 2215430,
  "god-of-war-ragnarok": 2322010,
  "spider-man-2": 0,           // PlayStation exclusive
  "marvels-spider-man-2": 0,
  "final-fantasy-vii-rebirth": 0, // PlayStation exclusive
  "silent-hill-2": 2124490,
  "silent-hill-2-remake": 2124490,
  "black-myth-wukong": 2358720,
  "starfield": 1716740,
  "cyberpunk-2077": 1091500,
  "the-witcher-3": 292030,
  "skyrim": 72850,
  "fallout-4": 377160,
  "red-dead-redemption-2": 1174180,
  "hollow-knight-silksong": 0, // not released yet
  "death-stranding-2": 0,      // not on Steam yet
  "marvels-wolverine": 0,      // PlayStation exclusive
  "elder-scrolls-vi": 0,     // not released yet
  "gta-vi": 0,               // not released yet, not on Steam
  "grand-theft-auto-vi": 0,
};

// Cache for Steam App ID lookups (in-memory for this session)
const steamIdCache = new Map<string, number | null>();

/** Search Steam Store for a game's App ID. Returns 0 if not on Steam, null if unknown. */
export async function searchSteamAppId(gameName: string): Promise<number | null> {
  const cached = steamIdCache.get(gameName);
  if (cached !== undefined) return cached;

  // Use the existing Steam proxy
  const url = `/api/steam/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      steamIdCache.set(gameName, null);
      return null;
    }
    const data = await res.json();
    const items = data?.items as Array<{ id: number; name: string }> | undefined;
    if (!items || items.length === 0) {
      steamIdCache.set(gameName, null);
      return null;
    }
    const best = items[0];
    steamIdCache.set(gameName, best.id);
    return best.id;
  } catch {
    steamIdCache.set(gameName, null);
    return null;
  }
}

/** Fetch current concurrent Steam players for a given App ID. Returns null if unavailable. */
export async function fetchSteamPlayerCount(appId: number): Promise<number | null> {
  if (appId <= 0) return null;
  try {
    const res = await fetch(
      `/api/steam/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const count = data?.response?.player_count;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

/** Get Steam player count for a game, using known IDs or searching the store. */
export async function getSteamPlayerCountForGame(
  gameSlug: string,
  gameName: string
): Promise<number | null> {
  // 1. Check hardcoded map first
  const known = KNOWN_STEAM_IDS[gameSlug.toLowerCase()];
  if (known !== undefined) {
    if (known === 0) return null; // explicitly not on Steam
    return fetchSteamPlayerCount(known);
  }

  // 2. Check if the DB already has a steam_appid
  try {
    const { data } = await supabase
      .from("games")
      .select("steam_appid")
      .eq("id", gameSlug)
      .single();
    if (data?.steam_appid) {
      return fetchSteamPlayerCount(data.steam_appid);
    }
  } catch {
    // ignore
  }

  // 3. Search Steam store
  const appId = await searchSteamAppId(gameName);
  if (appId && appId > 0) {
    // Write back to DB for future use
    try {
      await supabase
        .from("games")
        .update({ steam_appid: appId })
        .eq("id", gameSlug);
    } catch {
      // ignore write failures
    }
    return fetchSteamPlayerCount(appId);
  }
  return null;
}

// ── News Signal ─────────────────────────────────────────────────────────────

export interface NewsSignal {
  mentionCount: number;
  recentCount: number; // mentions in last 7 days
}

/** Count how many times each game is mentioned in cached article game_tags. */
export async function getNewsSignals(
  gameNames: string[]
): Promise<Map<string, NewsSignal>> {
  if (gameNames.length === 0) return new Map();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("cached_articles")
      .select("game_tags, article_date")
      .not("game_tags", "is", null);

    if (error || !data) return new Map();

    const signals = new Map<string, NewsSignal>();
    const lowerNames = gameNames.map((n) => n.toLowerCase());
    const nameSet = new Set(lowerNames);

    for (const row of data) {
      const tags: string[] = row.game_tags ?? [];
      const isRecent = row.article_date && row.article_date >= sevenDaysAgo;
      for (const tag of tags) {
        const t = tag.toLowerCase();
        // Match by exact name or substring
        const matched = lowerNames.find((n) => t === n || t.includes(n) || n.includes(t));
        if (matched) {
          const prev = signals.get(matched) ?? { mentionCount: 0, recentCount: 0 };
          prev.mentionCount++;
          if (isRecent) prev.recentCount++;
          signals.set(matched, prev);
        }
      }
    }

    return signals;
  } catch {
    return new Map();
  }
}

// ── Release Proximity Signal ────────────────────────────────────────────────

export interface ReleaseSignal {
  proximityScore: number; // 0–100
  daysUntil: number | null; // negative = already released
}

/** Score based on how close a game's release date is. */
export function getReleaseProximitySignal(releaseDateStr: string): ReleaseSignal {
  if (!releaseDateStr || releaseDateStr === "TBA") {
    return { proximityScore: 0, daysUntil: null };
  }

  const parsed = Date.parse(releaseDateStr);
  if (isNaN(parsed)) {
    return { proximityScore: 0, daysUntil: null };
  }

  const release = new Date(parsed);
  const now = new Date();
  const diffMs = release.getTime() - now.getTime();
  const daysUntil = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (daysUntil < -30) {
    // Released more than a month ago → no boost
    return { proximityScore: 0, daysUntil };
  }

  if (daysUntil < 0) {
    // Just released (within last 30 days) → boost, peak at day 0
    const daysSinceRelease = Math.abs(daysUntil);
    const proximityScore = Math.round((1 - daysSinceRelease / 30) * 100);
    return { proximityScore, daysUntil };
  }

  // Upcoming release → boost, peak 7 days before
  if (daysUntil <= 7) {
    return { proximityScore: 100, daysUntil };
  }
  if (daysUntil <= 30) {
    const proximityScore = Math.round((1 - (daysUntil - 7) / 23) * 80 + 20);
    return { proximityScore, daysUntil };
  }

  // More than 30 days away → small residual buzz for known big titles
  if (daysUntil <= 90) {
    return { proximityScore: Math.round((1 - (daysUntil - 30) / 60) * 15), daysUntil };
  }

  return { proximityScore: 0, daysUntil };
}

// ── Composite Trending Score ────────────────────────────────────────────────

export interface TrendingSignals {
  steamPlayers: number | null;
  newsMentions: number;
  newsRecentMentions: number;
  releaseProximityScore: number;
  daysUntilRelease: number | null;
  communityScore: number;
  rawgScore: number;
  compositeScore: number;
}

const WEIGHTS = {
  steam: 0.40,
  news: 0.25,
  release: 0.20,
  community: 0.10,
  rawg: 0.05,
};

/** Normalize a value to a 0–100 scale given a soft max. */
function normalize(value: number, softMax: number): number {
  if (value <= 0) return 0;
  const raw = (value / softMax) * 100;
  return Math.min(raw, 100);
}

/** Compute composite trending score for a list of games. */
export function computeTrendingScores(
  games: Array<{
    id: string;
    name: string;
    releaseDate: string;
    rawgRating: number;
    metacriticScore: number | null;
    ratingCount: number;
    rating: number;
  }>,
  steamPlayers: Map<string, number | null>,
  newsSignals: Map<string, NewsSignal>
): Map<string, TrendingSignals> {
  const out = new Map<string, TrendingSignals>();

  // Find maxima for normalization
  const maxSteam = Math.max(
    1,
    ...Array.from(steamPlayers.values()).filter((v): v is number => v !== null)
  );
  const maxNews = Math.max(
    1,
    ...Array.from(newsSignals.values()).map((s) => s.mentionCount)
  );
  const maxCommunity = Math.max(
    1,
    ...games.map((g) => g.ratingCount * g.rating)
  );

  for (const g of games) {
    const steam = steamPlayers.get(g.id) ?? null;
    const news = newsSignals.get(g.name.toLowerCase()) ?? { mentionCount: 0, recentCount: 0 };
    const release = getReleaseProximitySignal(g.releaseDate);
    const community = g.ratingCount * g.rating;
    const rawg = g.rawgRating * 10 + (g.metacriticScore ?? 0) / 10;

    const steamNorm = steam != null ? normalize(steam, maxSteam) : 0;
    const newsNorm = normalize(news.mentionCount + news.recentCount * 2, maxNews);
    const releaseNorm = release.proximityScore;
    const communityNorm = normalize(community, maxCommunity);
    const rawgNorm = normalize(rawg, 150); // max possible ~150 (50+100)

    const compositeScore = Math.round(
      steamNorm * WEIGHTS.steam +
        newsNorm * WEIGHTS.news +
        releaseNorm * WEIGHTS.release +
        communityNorm * WEIGHTS.community +
        rawgNorm * WEIGHTS.rawg
    );

    out.set(g.id, {
      steamPlayers: steam,
      newsMentions: news.mentionCount,
      newsRecentMentions: news.recentCount,
      releaseProximityScore: release.proximityScore,
      daysUntilRelease: release.daysUntil,
      communityScore: communityNorm,
      rawgScore: rawgNorm,
      compositeScore,
    });
  }

  return out;
}

/** Enrich catalog games with trending signals and sort by composite score. */
export function withTrendingSignals<
  T extends {
    id: string;
    name: string;
    releaseDate: string;
    rawgRating: number;
    metacriticScore: number | null;
    ratingCount: number;
    rating: number;
  }
>(games: T[], signals: Map<string, TrendingSignals>): (T & TrendingSignals)[] {
  const enriched = games.map((g) => {
    const s = signals.get(g.id);
    return {
      ...g,
      steamPlayers: s?.steamPlayers ?? null,
      newsMentions: s?.newsMentions ?? 0,
      newsRecentMentions: s?.newsRecentMentions ?? 0,
      releaseProximityScore: s?.releaseProximityScore ?? 0,
      daysUntilRelease: s?.daysUntilRelease ?? null,
      communityScore: s?.communityScore ?? 0,
      rawgScore: s?.rawgScore ?? 0,
      compositeScore: s?.compositeScore ?? 0,
    };
  });

  return enriched.sort((a, b) => b.compositeScore - a.compositeScore);
}

/** Format a player count for display (e.g. "482K", "12.3K", "456"). */
export function formatPlayerCount(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

/** Format a "why trending" subtitle for display. */
export function getTrendingReason(signals: TrendingSignals): string {
  const reasons: string[] = [];
  if (signals.steamPlayers && signals.steamPlayers > 10_000) {
    reasons.push(`🔥 ${formatPlayerCount(signals.steamPlayers)} playing on Steam`);
  }
  if (signals.newsRecentMentions > 0) {
    reasons.push(`📰 ${signals.newsRecentMentions} news mention${signals.newsRecentMentions > 1 ? "s" : ""} this week`);
  } else if (signals.newsMentions > 0) {
    reasons.push(`📰 ${signals.newsMentions} news mentions`);
  }
  if (signals.daysUntilRelease != null && signals.daysUntilRelease <= 30 && signals.daysUntilRelease > 0) {
    reasons.push(`🚀 Releases in ${signals.daysUntilRelease} day${signals.daysUntilRelease > 1 ? "s" : ""}`);
  } else if (signals.daysUntilRelease != null && signals.daysUntilRelease <= 7 && signals.daysUntilRelease >= 0) {
    reasons.push(`🚀 Just released!`);
  }
  if (reasons.length === 0 && signals.compositeScore > 0) {
    reasons.push("⭐ Community buzz");
  }
  return reasons.join(" · ") || "Trending";
}
