import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateGeminiJson, talusSystemPrompt } from "../_shared/talus-ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";
const ARTICLE_PROCESS_LIMIT = 15;
const YOUTUBE_PROCESS_LIMIT = 10;
const ARTICLE_SCRAPE_LIMIT = 25;
const YOUTUBE_SCRAPE_LIMIT = 20;
const PROCESS_CONCURRENCY = 3;
const ROLLING_ARTICLE_CAP = 100;
const INGESTION_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RssSourceConfig {
  id: string;
  url: string;
  source: string;
  dailyQuota: number;
  minQuota: number;
  maxQuota: number;
  lastSeenAt?: string | null;
  lastSeenArticleUrl?: string | null;
}

const RSS_FEEDS: RssSourceConfig[] = [
  { id: "ign", url: "https://www.ign.com/rss/articles/feed?tags=news", source: "IGN", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "gamespot", url: "https://www.gamespot.com/feeds/news/", source: "GameSpot", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "kotaku", url: "https://kotaku.com/feed", source: "Kotaku", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "polygon", url: "https://www.polygon.com/rss/index.xml", source: "Polygon", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "dexerto-twitch", url: "https://www.dexerto.com/twitch/feed/", source: "Dexerto Twitch", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "game-developer", url: "https://www.gamedeveloper.com/rss.xml", source: "Game Developer", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "pc-gamer", url: "https://www.pcgamer.com/rss/", source: "PCGamer", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "gematsu", url: "https://www.gematsu.com/feed", source: "Gematsu", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "vg247", url: "https://www.vg247.com/feed", source: "VG247", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "game-informer", url: "https://gameinformer.com/rss.xml", source: "Game Informer", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "wccftech", url: "https://wccftech.com/topic/games/feed/", source: "WCCFtech", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "gamesradar", url: "https://www.gamesradar.com/rss/", source: "GamesRadar", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  // Added 2026-07-07 (QA F10.5). Additive only: same parser, same gaming
  // filter; excess items drain on later cron runs.
  { id: "eurogamer", url: "https://www.eurogamer.net/feed", source: "Eurogamer", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "rock-paper-shotgun", url: "https://www.rockpapershotgun.com/feed", source: "Rock Paper Shotgun", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "destructoid", url: "https://www.destructoid.com/feed/", source: "Destructoid", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "siliconera", url: "https://www.siliconera.com/feed/", source: "Siliconera", dailyQuota: 5, minQuota: 2, maxQuota: 8 },
  { id: "nintendo-life", url: "https://www.nintendolife.com/feeds/latest", source: "Nintendo Life", dailyQuota: 4, minQuota: 2, maxQuota: 7 },
  { id: "push-square", url: "https://www.pushsquare.com/feeds/latest", source: "Push Square", dailyQuota: 4, minQuota: 2, maxQuota: 7 },
  { id: "dot-esports", url: "https://dotesports.com/feed", source: "Dot Esports", dailyQuota: 4, minQuota: 2, maxQuota: 7 },
  { id: "gamesindustry", url: "https://www.gamesindustry.biz/feed", source: "GamesIndustry.biz", dailyQuota: 4, minQuota: 2, maxQuota: 7 },
  { id: "game-rant", url: "https://gamerant.com/feed/", source: "Game Rant", dailyQuota: 4, minQuota: 2, maxQuota: 7 },
  { id: "esports-insider", url: "https://esportsinsider.com/feed", source: "Esports Insider", dailyQuota: 4, minQuota: 1, maxQuota: 7 },
  { id: "sheep-esports", url: "https://www.sheepesports.com/feed", source: "Sheep Esports", dailyQuota: 4, minQuota: 1, maxQuota: 7 },
  { id: "hltv", url: "https://www.hltv.org/rss/news", source: "HLTV", dailyQuota: 4, minQuota: 1, maxQuota: 7 },
  { id: "vlr", url: "https://www.vlr.gg/rss", source: "VLR", dailyQuota: 4, minQuota: 1, maxQuota: 7 },
];

// ---------------------------------------------------------------------------
// RSS parser (no DOM — pure regex)
// ---------------------------------------------------------------------------
interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  description: string;
  enclosureUrl: string | null;
  source: string;
  mediaType?: "article" | "youtube";
  videoId?: string;
}

interface YouTubeSource {
  id: string;
  source_name: string;
  channel_id: string;
  uploads_playlist_id: string;
  channel_url: string;
  freshness_hours: number;
  poll_interval_minutes: number;
  last_polled_at: string | null;
  quota_units_used_today: number;
  quota_date: string;
}

interface YouTubeFetchResult {
  items: RssItem[];
  quotaUnits: number;
  mode: "data_api" | "atom_fallback";
  error: string | null;
}

function isTrailerCandidate(title: string): boolean {
  return /\b(trailer|teaser|gameplay|dlc|expansion|reveal|announcement|launch|release date|cinematic)\b/i.test(title)
    && !/\b(live stream|day \d|full show|coverage)\b/i.test(title);
}

function isYouTubeCandidate(source: YouTubeSource, title: string): boolean {
  if (source.id === "gametrailers") return isTrailerCandidate(title);
  return !/\b(live stream|livestream|stream replay|full stream)\b|#shorts?\b/i.test(title);
}

interface FeedFetchResult {
  items: RssItem[];
  status: number | null;
  contentType: string;
  bytes: number;
  rawItemTags: number;
  preview: string;
  error: string | null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

function extractCDATA(block: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(cdataRe) || block.match(plainRe);
  return m ? decodeHtmlEntities(m[1].trim()) : "";
}

function normalizeFeedLink(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("bing.com") && url.pathname.includes("/news/apiclick")) {
      const original = url.searchParams.get("url");
      if (original?.startsWith("http")) return original;
    }
  } catch {
    // Keep the feed-provided value when it is not a URL we recognize.
  }
  return value;
}

/**
 * Interleave publishers so the process limit cannot permanently starve feeds
 * near the bottom of RSS_FEEDS. Rotate the starting publisher hourly so the
 * final slot is also shared fairly when there are more publishers than slots.
 */
function interleaveBySource(items: RssItem[]): RssItem[] {
  const grouped = new Map<string, RssItem[]>();
  for (const item of items) {
    const group = grouped.get(item.source) ?? [];
    group.push(item);
    grouped.set(item.source, group);
  }

  const groups = [...grouped.entries()];
  if (groups.length === 0) return [];
  const offset = Math.floor(Date.now() / 3_600_000) % groups.length;
  const rotated = [...groups.slice(offset), ...groups.slice(0, offset)];
  const ordered: RssItem[] = [];

  for (let index = 0; ; index++) {
    let added = false;
    for (const [, group] of rotated) {
      if (group[index]) {
        ordered.push(group[index]);
        added = true;
      }
    }
    if (!added) break;
  }
  return ordered;
}

/**
 * Skip articles that are clearly not gaming-related (movies, TV, Oscars, etc.)
 * while keeping gaming-adjacent content (e.g. SpongeBob on Kotaku).
 */
function isGamingRelated(title: string, description: string): boolean {
  const text = (title + " " + description).toLowerCase();

  // Strong non-gaming signals — skip these
  const skipSignals = [
    /\bacademy awards?\b/,
    /\boscars?\b/,
    /\bgrammys?\b/,
    /\bemmys?\b/,
    /\bgolden globes?\b/,
    /\bred carpet\b/,
    /\bbox office\b/,
    /\bnetflix.*(shows?|series|watch|movies?)\b/,
    /\bhbo.*(shows?|series|watch|movies?)\b/,
    /\bdisney\+?.*(shows?|series|watch|movies?)\b/,
    /\bprime video\b/,
    /\bhulu\b/,
    /\bpeacock\b/,
    /\bparamount\+?\b/,
    /\bapple tv\+?\b/,
    /\bwhat to watch\b/,
    /\bbest movies?\b/,
    /\bbest shows?\b/,
    /\bbest series\b/,
    /\bmovie review\b/,
    /\bfilm review\b/,
    /\btv review\b/,
    /\bseries review\b/,
    /\bseason \d+ review\b/,
    /\bcoming to netflix\b/,
    /\bcoming to hbo\b/,
    /\bcoming to disney\b/,
    /\bstreaming (this weekend|today|now)\b/,
    /\bnarnia\b/,
    /\bharry potter\b/,
    /\bhunger games\b/,
    /\btwilight\b/,
    /\bjurassic\b/,
    /\bfast & furious\b/,
    /\bmission: impossible\b/,
    /\bjames bond\b/,
    /\b007\b/,
    /\blord of the rings\b/,
    /\bstar trek\b/,
    /\bwestworld\b/,
    /\bgame of thrones\b/,
    /\bhouse of the dragon\b/,
    /\bthe last of us\b(?!.*\bgame\b)/,
    /\brogue squirrel\b/,
  ];

  for (const re of skipSignals) {
    if (re.test(text)) return false;
  }

  return true;
}

function parseRSSItems(xml: string, source: string, maxItems = 5): RssItem[] {
  const items: RssItem[] = [];
  const rssBlocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  const atomBlocks = rssBlocks.length === 0
    ? [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)]
    : [];

  for (const match of [...rssBlocks, ...atomBlocks]) {
    const block = match[1];

    const title = extractCDATA(block, "title");
    const link  = normalizeFeedLink(
                    extractCDATA(block, "link")
                 || decodeHtmlEntities(block.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim() || "")
                  );
    if (!title || !link) continue;

    // Dexerto's /twitch/feed/ occasionally includes Entertainment and YouTube
    // posts. Keep this source strictly scoped to its Twitch publication path.
    if (source === "Dexerto Twitch") {
      try {
        const articleUrl = new URL(link);
        if (!articleUrl.hostname.endsWith("dexerto.com") || !articleUrl.pathname.startsWith("/twitch/")) {
          console.log(`  [SKIP] Non-Twitch Dexerto URL: ${link}`);
          continue;
        }
      } catch {
        continue;
      }
    }

    const pubDate     = extractCDATA(block, "pubDate")
                     || extractCDATA(block, "published")
                     || extractCDATA(block, "updated")
                     || new Date().toISOString();
    const author      = extractCDATA(block, "dc:creator")
                     || extractCDATA(block, "name")
                     || extractCDATA(block, "author")
                     || "Staff Writer";
    // Prefer content:encoded if it's significantly longer than description
    const descRaw     = extractCDATA(block, "description") || extractCDATA(block, "summary") || "";
    const contentRaw  = extractCDATA(block, "content:encoded") || extractCDATA(block, "content") || "";
    const descWords   = descRaw.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const contentWords = contentRaw.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const description = contentWords > descWords + 10 ? contentRaw : (descRaw || contentRaw);

    if (!isGamingRelated(title, description)) {
      console.log(`  [SKIP] Non-gaming: "${title.substring(0, 60)}..."`);
      continue;
    }

    const enclosureUrl =
      block.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
      description.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
      description.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
      null;

    items.push({ title, link, pubDate, author, description, enclosureUrl, source });
    if (items.length >= maxItems) break;
  }
  return items;
}

function parseYouTubeAtom(xml: string, source: YouTubeSource): RssItem[] {
  const cutoff = Date.now() - source.freshness_hours * 60 * 60 * 1000;
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const block = match[1];
    const videoId = extractCDATA(block, "yt:videoId");
    const title = extractCDATA(block, "title");
    const published = extractCDATA(block, "published");
    if (!videoId || !title || !published) continue;
    if (new Date(published).getTime() < cutoff) break;
    if (!isYouTubeCandidate(source, title)) continue;
    const description = extractCDATA(block, "media:description");
    const author = extractCDATA(block, "name") || source.source_name;
    const thumbnail = decodeHtmlEntities(
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] || ""
    );
    items.push({
      title,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      pubDate: published,
      author,
      description,
      enclosureUrl: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: source.source_name,
      mediaType: "youtube",
      videoId,
    });
  }
  return items;
}

async function fetchYouTubeUploads(source: YouTubeSource): Promise<YouTubeFetchResult> {
  const cutoff = Date.now() - source.freshness_hours * 60 * 60 * 1000;
  if (!YOUTUBE_API_KEY) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(source.uploads_playlist_id)}`;
      const response = await fetch(feedUrl, {
        headers: { "User-Agent": "Talus/1.0 (+https://pixel-pulse-roan.vercel.app)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`YouTube Atom HTTP ${response.status}`);
      const items = parseYouTubeAtom(await response.text(), source);
      console.log(`  ${source.source_name}: ${items.length} fresh videos (official Atom fallback; 0 quota units)`);
      return { items, quotaUnits: 0, mode: "atom_fallback", error: null };
    } catch (error) {
      return { items: [], quotaUnits: 0, mode: "atom_fallback", error: String(error) };
    }
  }

  const items: RssItem[] = [];
  let pageToken = "";
  let quotaUnits = 0;
  try {
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", source.uploads_playlist_id);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", YOUTUBE_API_KEY);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      quotaUnits += 1;
      if (!response.ok) throw new Error(`YouTube Data API HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
      const payload = await response.json();
      let reachedCutoff = false;
      for (const row of payload.items ?? []) {
        const snippet = row.snippet ?? {};
        const videoId = row.contentDetails?.videoId || snippet.resourceId?.videoId;
        const published = row.contentDetails?.videoPublishedAt || snippet.publishedAt;
        if (!videoId || !published) continue;
        if (new Date(published).getTime() < cutoff) {
          reachedCutoff = true;
          break;
        }
        const title = snippet.title || "New gaming video";
        if (!isYouTubeCandidate(source, title)) continue;
        items.push({
          title,
          link: `https://www.youtube.com/watch?v=${videoId}`,
          pubDate: published,
          author: snippet.videoOwnerChannelTitle || source.source_name,
          description: snippet.description || "",
          enclosureUrl: snippet.thumbnails?.maxres?.url
            || snippet.thumbnails?.high?.url
            || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          source: source.source_name,
          mediaType: "youtube",
          videoId,
        });
      }
      if (reachedCutoff || !payload.nextPageToken) break;
      pageToken = payload.nextPageToken;
    }
    console.log(`  ${source.source_name}: ${items.length} fresh videos (${quotaUnits} quota units)`);
    return { items, quotaUnits, mode: "data_api", error: null };
  } catch (error) {
    return { items: [], quotaUnits, mode: "data_api", error: String(error) };
  }
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en&fmt=json3`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return "";
    const payload = await response.json();
    const transcript = (payload.events ?? [])
      .flatMap((event: { segs?: { utf8?: string }[] }) => event.segs ?? [])
      .map((segment: { utf8?: string }) => segment.utf8 ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return transcript.length >= 80 ? transcript : "";
  } catch {
    return "";
  }
}

function normalizedTitleTokens(title: string): Set<string> {
  const ignored = new Set(["official", "trailer", "gameplay", "video", "new", "the", "a", "an", "for", "of", "and"]);
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter((token) => token.length > 2 && !ignored.has(token))
  );
}

function titleSimilarity(left: string, right: string): number {
  const a = normalizedTitleTokens(left);
  const b = normalizedTitleTokens(right);
  if (a.size < 2 || b.size < 2) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

interface DedupeResult {
  items: RssItem[];
  duplicateCount: number;
  duplicateUrls: string[];
  duplicatesBySource: Record<string, number>;
  nearMissesBySource: Record<string, number>;
}

function deduplicateCandidates(items: RssItem[], existingTitles: string[]): DedupeResult {
  const acceptedTitles = [...existingTitles];
  const unique: RssItem[] = [];
  const duplicatesBySource: Record<string, number> = {};
  const nearMissesBySource: Record<string, number> = {};
  const duplicateUrls: string[] = [];
  let duplicateCount = 0;

  for (const item of interleaveBySource(items)) {
    let highestSimilarity = 0;
    for (const title of acceptedTitles) {
      highestSimilarity = Math.max(highestSimilarity, titleSimilarity(item.title, title));
      if (highestSimilarity >= 0.85) break;
    }
    if (highestSimilarity >= 0.85) {
      duplicateCount++;
      duplicateUrls.push(item.link);
      duplicatesBySource[item.source] = (duplicatesBySource[item.source] ?? 0) + 1;
      continue;
    }
    if (highestSimilarity >= 0.7) {
      nearMissesBySource[item.source] = (nearMissesBySource[item.source] ?? 0) + 1;
      console.log(`  [DEDUPE NEAR MISS ${highestSimilarity.toFixed(2)}] ${item.source}: ${item.title}`);
    }
    unique.push(item);
    acceptedTitles.push(item.title);
  }

  return { items: unique, duplicateCount, duplicateUrls, duplicatesBySource, nearMissesBySource };
}

function relevanceScore(item: RssItem): number {
  const title = item.title.toLowerCase();
  let score = 0;
  if (/\b(announce|announced|launch|launched|release|released|reveal|revealed)\b/.test(title)) score += 3;
  if (/\b(update|patch|dlc|expansion|trailer|gameplay|showcase|delay|acquisition)\b/.test(title)) score += 2;
  if (/\b(playstation|xbox|nintendo|steam|epic|twitch|esports|switch|pc)\b/.test(title)) score += 1;
  const ageHours = Math.max(0, (Date.now() - new Date(item.pubDate).getTime()) / 3_600_000);
  score += Math.max(0, 3 - ageHours / 24);
  return score;
}

interface AllocationResult {
  items: RssItem[];
  allocatedBySource: Record<string, number>;
  candidateCountBySource: Record<string, number>;
}

function allocateArticleSlots(
  candidates: RssItem[],
  sources: RssSourceConfig[],
  targetTotal: number,
  alreadyPublishedBySource: Record<string, number>,
): AllocationResult {
  // A small paced allowance means source order matters. Rotate the first source
  // every 30 minutes so the same publishers do not claim every early slot.
  const sourceOffset = sources.length > 0
    ? Math.floor(Date.now() / (30 * 60 * 1000)) % sources.length
    : 0;
  const orderedSources = [
    ...sources.slice(sourceOffset),
    ...sources.slice(0, sourceOffset),
  ];
  const ranked = new Map<string, RssItem[]>();
  const candidateCountBySource: Record<string, number> = {};
  for (const source of orderedSources) {
    const sourceItems = candidates
      .filter((item) => item.source === source.source)
      .sort((a, b) => relevanceScore(b) - relevanceScore(a));
    ranked.set(source.source, sourceItems);
    candidateCountBySource[source.source] = sourceItems.length;
  }

  const selected = new Map<string, RssItem[]>();
  let remaining = Math.max(0, targetTotal);

  // Pass 1: fill base quotas round-robin. With the normal two-slot allowance,
  // this selects two different publishers instead of two stories from one feed.
  while (remaining > 0) {
    let added = false;
    for (const source of orderedSources) {
      if (remaining <= 0) break;
      const available = ranked.get(source.source) ?? [];
      const chosen = selected.get(source.source) ?? [];
      const already = alreadyPublishedBySource[source.source] ?? 0;
      const baseRoom = Math.max(0, source.dailyQuota - already);
      if (chosen.length >= available.length || chosen.length >= baseRoom) continue;
      chosen.push(available[chosen.length]);
      selected.set(source.source, chosen);
      remaining--;
      added = true;
    }
    if (!added) break;
  }

  // Pass 2: redistribute unused quota one slot at a time, respecting maxQuota.
  while (remaining > 0) {
    let added = false;
    for (const source of orderedSources) {
      if (remaining <= 0) break;
      const available = ranked.get(source.source) ?? [];
      const chosen = selected.get(source.source) ?? [];
      const already = alreadyPublishedBySource[source.source] ?? 0;
      if (chosen.length >= available.length || already + chosen.length >= source.maxQuota) continue;
      chosen.push(available[chosen.length]);
      selected.set(source.source, chosen);
      remaining--;
      added = true;
    }
    if (!added) break;
  }

  const allocatedBySource: Record<string, number> = {};
  const flat: RssItem[] = [];
  const maxDepth = Math.max(0, ...[...selected.values()].map((items) => items.length));
  for (let index = 0; index < maxDepth; index++) {
    for (const source of orderedSources) {
      const item = selected.get(source.source)?.[index];
      if (!item) continue;
      flat.push(item);
      allocatedBySource[source.source] = (allocatedBySource[source.source] ?? 0) + 1;
    }
  }

  return { items: flat, allocatedBySource, candidateCountBySource };
}

// ---------------------------------------------------------------------------
// Strip HTML tags from RSS description
// ---------------------------------------------------------------------------
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/\s*The post .+ appeared first on .+\.?\s*$/i, "")
    .replace(/\s*(Read more|…\s*Source|Continue reading|Full story)[^.]*\.?\s*$/i, "")
    .replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Article scraper
// ---------------------------------------------------------------------------
function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/\s+/g, " ").trim();
}

function paragraphsFrom(html: string): string {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 80 || (p.length > 40 && /[.!?"'»]$/.test(p)))
    .join(" ");
}

function extractArticleText(html: string): string {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+class="[^"]*(?:c-related|e-recommended|related[-_]article|sidebar[-_]?|read-next|read-more|newsletter|promo|ad[-_]unit|widget|share-bar|social-bar|author-bio|bio-box)[^"]*"[^>]*>[\s\S]*?<\/(?:div|ul|li|section|aside)>/gi, " ")
    .replace(/Sign in to your [^.]+\.com account[^.]*\./gi, "")
    .replace(/<li[^>]*>\s*<a[^>]*>[^<]{5,120}<\/a>\s*<\/li>/gi, " ");

  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(stripped);
  if (articleMatch) { const t = paragraphsFrom(articleMatch[1]); if (t.length > 200) return t; }

  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(stripped);
  if (mainMatch) { const t = paragraphsFrom(mainMatch[1]); if (t.length > 200) return t; }

  const classRe = /<div[^>]*class="[^"]*(?:article[-_]body|article[-_]content|post[-_]content|entry[-_]content|story[-_]body|content[-_]body|prose|richtext|article__body|article_body_content|post-body|entry-body|post__content|content__body|field--body|node__content|page-content|js-post-body|post__content-body|article__content|article-body-component|body-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
  const classMatch = classRe.exec(stripped);
  if (classMatch) { const t = paragraphsFrom(classMatch[1]); if (t.length > 200) return t; }

  const sectionMatch = /<section[^>]*class="[^"]*(?:article|story|content)[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(stripped);
  if (sectionMatch) { const t = paragraphsFrom(sectionMatch[1]); if (t.length > 200) return t; }

  const allP = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 80 || (p.length > 40 && /[.!?"'»]$/.test(p)));
  if (allP.length >= 2) return allP.slice(0, 12).join(" ");

  return "";
}

function removeBoilerplate(text: string): string {
  return text
    .replace(/When you (purchase|buy) through links[^.]+\./gi, "")
    .replace(/Here['']s how it works\s*\.?\s*/gi, "")
    .replace(/\(?Image credit:[^)\n.]{0,80}\)?/gi, "")
    .replace(/Image:\s*[^.|\n]{0,80}?(via\s+\w+\s*)?(?=[A-Z][a-z])/g, "")
    .replace(/[\w\s/,]+via\s+(Polygon|IGN|GameSpot|Kotaku|PCGamer|Dexerto|VG247|Gematsu)\s*/gi, "")
    .replace(/\d+\s+comments?\s*/gi, "")
    .replace(/\bFollow\b\s*/g, "")
    .replace(/(Flipboard|Pinterest|Reddit|Whatsapp|Facebook|Twitter|Email)\s+(Email\s+)?(Share this article\s*\d*\s*)?(Join the conversation\s*)?(Follow us\s*)?(Add us as[^.]+\.?)?/gi, "")
    .replace(/Copy link\s*(Facebook|Twitter|X|Whatsapp|Reddit|Pinterest|Email)(\s+(Facebook|Twitter|X|Whatsapp|Reddit|Pinterest|Email))*/gi, "")
    .replace(/Add us as a preferred source on[^.]+\.?/gi, "")
    .replace(/Jump Links?\s*/gi, "")
    .replace(/Contents\s+\d+/gi, "")
    .replace(/\b[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4},?\s+\d{1,2}:\d{2}\b/g, "")
    .replace(/Unlock instant access to[^.]+\./gi, "")
    .replace(/By submitting your information you agree to[^.]+\./gi, "")
    .replace(/Sign up to[^.]+newsletter[^.]+\.?/gi, "")
    .replace(/Save for later\s*/gi, "")
    .replace(/Get Notifications for[^.]+\.?/gi, "")
    .replace(/Sign in to your [^.]+\.com account[^.]*\./gi, "")
    .replace(/\bCreate an account\b[^.]*\./gi, "")
    .replace(/\bby\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*(Published|Updated|·|\|)?/g, "")
    .replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]{2,8}\s+\d{1,2}\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*[APM]{2}\s+[A-Z]{2,4}\s+\d+\s*/g, "")
    .replace(/[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]{2,8}\s+\d{1,2}\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*[APM]{2}\s+[A-Z]{2,4}\s+\d+\s*/g, "")
    .replace(/You are now subscribed[^.]*\.?/gi, "")
    .replace(/Your weekly update on everything[^.]*\.?/gi, "")
    .replace(/A weekly videogame industry newsletter[^.]*\.?/gi, "")
    .replace(/From the creators of Edge[^.]*\.?/gi, "")
    .replace(/Jump to:\s*[^.]{0,200}(?=\s[A-Z])/g, "")
    .replace(/\b(Read more|Related|See also)\s*:/gi, "")
    .replace(/♬\s+[^♬]+♬/g, "")
    .replace(/It['']s-a me,\s*Chocolate\s*Mario!\s*🍄[^\n]*/gi, "")
    .replace(/#\w+\s+#\w+\s+#\w+/g, "")
    .replace(/\s+/g, " ").trim();
}

interface ScrapeResult {
  text: string;
  ogImage: string | null;
  method: string;
}

async function scrapeArticleDirect(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      "Connection": "keep-alive",
    },
    redirect: "follow",
  });
  clearTimeout(tid);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    throw new Error(`Non-HTML content: ${ct}`);
  }
  const html = await res.text();

  const ogImage =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] ||
    null;

  const raw = extractArticleText(html);
  const clean = removeBoilerplate(raw);
  return {
    text: clean.length > 200 ? clean.substring(0, 6000) : "",
    ogImage: ogImage ?? null,
    method: "direct",
  };
}

async function scrapeArticleJina(url: string): Promise<ScrapeResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(jinaUrl, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  clearTimeout(tid);

  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const raw = await res.text();

  // Normalise line endings so the metadata regexes always match
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strip Jina metadata header block — match greedily up to "Markdown Content:"
  // then drop the header label itself, leaving only the article body.
  const content = text
    .replace(/^\uFEFF/, "")                         // strip BOM if present
    .replace(/^[\s\S]*?Markdown Content:\s*/i, "")     // drop everything before article body
    // markdown → plain text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")              // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")           // [text](url) → text
    .replace(/^#{1,6}\s+/gm, "")                       // ## headers
    .replace(/\*\*([^*]+)\*\*/g, "$1")                 // **bold**
    .replace(/\*([^*]+)\*/g, "$1")                     // *italic*
    .replace(/`[^`]+`/g, "")                           // `code`
    .replace(/^[-*+]\s+/gm, "")                        // bullet points
    .replace(/^\d+\.\s+/gm, "")                        // numbered lists
    .replace(/^>\s+/gm, "")                            // blockquotes
    .replace(/\|[^\n]+\|/g, "")                        // tables
    .replace(/^---+$/gm, "")                           // horizontal rules
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Safety net: if metadata stripping didn't work and raw markers survived, bail out
  if (/^(Title:|URL Source:|Published Time:)/i.test(content)) {
    console.warn("  [jina] metadata stripping failed — skipping");
    return { text: "", ogImage: null, method: "jina" };
  }

  return {
    text: content.length > 200 ? content.substring(0, 6000) : "",
    ogImage: null,
    method: "jina",
  };
}

async function scrapeArticle(url: string): Promise<ScrapeResult> {
  try {
    const result = await scrapeArticleDirect(url);
    if (result.text.length > 200) return result;
    console.log(`  direct scrape short (${result.text.length} chars), trying Jina...`);
  } catch (err) {
    console.log(`  direct scrape failed: ${err}, trying Jina...`);
  }

  try {
    const result = await scrapeArticleJina(url);
    if (result.text.length > 200) return result;
    console.log(`  Jina scrape short (${result.text.length} chars)`);
  } catch (err) {
    console.log(`  Jina scrape failed: ${err}`);
  }

  return { text: "", ogImage: null, method: "failed" };
}

// ---------------------------------------------------------------------------
// AI summary + exactly two content-derived topic hashtags
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = talusSystemPrompt(`Condense gaming news into a concise, curiosity-led Talus news card.

WRITING STYLE:
- Confident, specific, natural, and useful. Lead with the strongest verified development.
- Build curiosity through concrete stakes or consequences, never by withholding the core fact.
- Use 2 or 3 complete sentences and 50-60 words total.
- Vary sentence rhythm while keeping every sentence informative.
- Never use: "dives into", "it's worth noting", "in conclusion", "comprehensive",
  "significantly", "moreover", "furthermore", "according to", "in a statement",
  "delve", "in today's gaming world"
- Never start with: "In this article", "This article discusses", "This news covers"
- Never use rhetorical questions, exclamation points, or em dashes.

OUTPUT FORMAT — return ONLY valid JSON with exactly these three keys:
{
  "summary": "50-60 word summary here",
  "gameTags": ["GameTitle1", "GameTitle2"],
  "tags": ["PrimaryTopic", "SecondaryTopic"]
}

gameTags RULES (game titles ONLY — this powers the review-prompt feature):
- Include every game title explicitly mentioned in the article
- PascalCase, no spaces, no # symbol: "Overwatch2", "GTA6", "EldenRing", "BaldursGate3"
- Sequels/editions MUST include the number: "Overwatch2" not "Overwatch"
- If no specific game is mentioned, use []
- Max 3 game titles

tags RULES (EXACTLY 2 topic hashtags for this specific article):
- Return exactly two strings, ordered from most important topic to second most important
- Use only a game, studio/publisher, real person, event, team, league, or hardware platform
  explicitly central to the title and article
- Prefer the main game or subject first, then the most relevant related entity
- PascalCase, no spaces, no # symbol: "GTA6", "RockstarGames", "HideoKojima", "EVO2026"
- Do not invent, broaden, or infer a topic that is not explicitly supported by the article
- Do not return two spelling variants of the same topic

BANNED TAGS (never include in either array): Gaming, News, Game, Games, Update, Updates,
Entertainment, RPG, FPS, Action, Adventure, Horror, Review, Preview, Trailer, Rumor,
Leak, Gameplay, Streaming, YouTube, PCGaming, MobileGaming, Esports`);

interface SummarizeResult {
  headline?: string;
  summary: string;
  gameTags: string[];
  tags: string[];
  rateLimited?: boolean;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cachedArticleIsPublishReady(row: {
  ai_summary?: string | null;
  summary?: string | null;
  media_type?: string | null;
}): boolean {
  const summary = (row.ai_summary || row.summary || "").trim();
  const words = countWords(summary);
  return words >= (row.media_type === "youtube" ? 20 : 30)
    && /[.!?"']$/.test(summary)
    && !/\.{2,}$|…$/.test(summary);
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
}

const BANNED_TOPIC_TAGS = new Set([
  "game", "games", "gaming", "gamer", "gamers", "news", "gamingnews",
  "videogame", "videogames", "update", "updates", "entertainment",
  "rpg", "fps", "action", "adventure", "horror", "review", "preview",
  "trailer", "rumor", "leak", "gameplay", "streaming",
  "youtube", "pcgaming", "mobilegaming", "esports",
]);

function sanitizeTopicTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const clean = raw
      .replace(/^#+/, "")
      .trim()
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")
      .substring(0, 39);
    const key = clean.toLowerCase();
    if (clean.length < 2 || BANNED_TOPIC_TAGS.has(key) || seen.has(key)) continue;
    seen.add(key);
    tags.push(clean);
    if (tags.length === 2) break;
  }

  return tags;
}

function buildSourceExcerpt(content: string): string {
  const clean = removeBoilerplate(content)
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || /^(Title:|URL Source:|Published Time:|Markdown Content:)/i.test(clean)) return "";

  const candidates = clean.match(/[^.!?]+[.!?]+(?:["']|$)?/g) ?? [];
  const selected: string[] = [];
  let words = 0;
  for (const candidate of candidates) {
    const sentence = candidate.trim();
    const sentenceWords = countWords(sentence);
    if (sentenceWords < 7 || sentenceWords > 45) continue;
    if (/https?:\/\/|subscribe|cookie|privacy policy|sign up|log in/i.test(sentence)) continue;
    if (words + sentenceWords > 90) break;
    selected.push(sentence);
    words += sentenceWords;
    if (words >= 50 || selected.length === 4) break;
  }

  // Publisher RSS descriptions are sometimes only one or two sentences. They
  // are still preferable to dropping a valid article when every AI provider is
  // unavailable, provided the excerpt is substantial and ends cleanly.
  const excerpt = selected.join(" ").trim();
  return countWords(excerpt) >= 20 && excerpt.length >= 100 ? excerpt : "";
}

function parseSummaryResult(raw: string, provider: string): SummarizeResult | null {
  const parsed = extractJsonObject(raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim());
  if (!parsed) {
    console.warn(`  ${provider}: JSON parse failed`);
    return null;
  }

  let summary = String(parsed.summary ?? "").trim();
  if (!summary) return null;
  summary = summary
    .replace(/^Title:\s*/i, "")
    .replace(/\s*URL Source:\s*https?:\/\/\S+/gi, "")
    .replace(/\s*Published Time:\s*[^.]+/gi, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (/\.{2,}\s*$|…\s*$/.test(summary)) {
    summary = summary.replace(/\.{2,}\s*$|…\s*$/g, "").trim();
    const lastStop = Math.max(summary.lastIndexOf(". "), summary.lastIndexOf("! "), summary.lastIndexOf("? "));
    summary = lastStop > 80 ? summary.substring(0, lastStop + 1).trim() : "";
  }

  const wc = countWords(summary);
  const sentences = countSentences(summary);
  if (wc < 45 || wc > 65 || sentences < 2 || summary.startsWith("http") || !/[.!?"']/.test(summary.slice(-1))) {
    console.warn(`  ${provider}: rejected (${wc}w, ${sentences}s)`);
    return null;
  }

  const tags = sanitizeTopicTags(parsed.tags);
  if (tags.length !== 2) {
    console.warn(`  ${provider}: summary accepted with ${tags.length}/2 topic tags; grounded headline repair will complete them`);
  }
  const gameTags = (Array.isArray(parsed.gameTags) ? parsed.gameTags as unknown[] : [])
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 1 && tag.length < 40)
    .slice(0, 3);

  console.log(`  ok ${wc}w ${sentences}s (${provider})`);
  return { summary, gameTags, tags };
}

async function summarizeWithGemini(title: string, content: string): Promise<SummarizeResult> {
  if (countWords(content) < 15) return { summary: "", gameTags: [], tags: [] };
  try {
    const contentJson = await generateGeminiJson(
      SYSTEM_PROMPT,
      `Article Title: ${title}\n\nArticle Content:\n${content.substring(0, 2800)}\n\nWrite 2-3 complete sentences totaling 50-60 words. Return ONLY valid JSON with summary, gameTags, and tags.`,
      { maxOutputTokens: 1200, timeoutMs: 60_000, service: "news-ingestion", operation: "summarize-article" },
    );
    return parseSummaryResult(contentJson, "Gemini")
      ?? { summary: "", gameTags: [], tags: [] };
  } catch (error) {
    console.warn("  Gemini error:", error);
    return { summary: "", gameTags: [], tags: [] };
  }
}

async function summarizeWithGroq(title: string, content: string): Promise<SummarizeResult> {
  if (!GROQ_API_KEY) return { summary: "", gameTags: [], tags: [] };
  // Not enough content to produce a real summary — skip and retry next run
  if (countWords(content) < 15) return { summary: "", gameTags: [], tags: [] };

  const userPrompt = `Article Title: ${title}

Article Content:
${content.substring(0, 2800)}

Write 2-3 complete sentences totaling 50-60 words. Return ONLY valid JSON with ALL THREE keys:
{
  "summary": "your summary here",
  "gameTags": ["GameTitle1", "GameTitle2"],
  "tags": ["PrimaryTopic", "SecondaryTopic"]
}`;

  let totalRetries = 0;
  let sawRateLimit = false;
  let rateLimitWaitMs = 0;
  const MAX_RATE_LIMIT_WAIT_MS = 20000; // per-article budget for 429 backoff
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    for (const model of MODELS) {
      totalRetries++;
      try {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user",   content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) {
          await res.text(); // drain body
          sawRateLimit = true;
          // Respect Retry-After if present, otherwise back off 5s.
          const retryAfterSec = parseFloat(res.headers.get("retry-after") ?? "") || 5;
          const waitMs = Math.min(retryAfterSec * 1000, MAX_RATE_LIMIT_WAIT_MS - rateLimitWaitMs);
          if (waitMs <= 0) {
            console.warn(`  [retry ${totalRetries}] Groq ${model} 429 — backoff budget exhausted`);
            return { summary: "", gameTags: [], tags: [], rateLimited: true };
          }
          console.warn(`  [retry ${totalRetries}] Groq ${model} 429 — waiting ${Math.round(waitMs / 1000)}s`);
          rateLimitWaitMs += waitMs;
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`  [retry ${totalRetries}] Groq ${model} ${res.status}: ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content ?? "")
          .replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

        const parsed = extractJsonObject(raw);
        if (!parsed) { console.warn(`  [retry ${totalRetries}] ${model}: JSON parse failed`); continue; }

        let summary = String(parsed.summary ?? "").trim();
        if (!summary) { console.warn(`  [retry ${totalRetries}] ${model}: empty summary`); continue; }

        // Strip any leaked metadata that Groq might have parroted
        summary = summary
          .replace(/^Title:\s*/i, "")
          .replace(/\s*URL Source:\s*https?:\/\/\S+/gi, "")
          .replace(/\s*Published Time:\s*[^.]+/gi, "")
          .replace(/\s+([.,;:!?])/g, "$1")
          .replace(/\s+/g, " ")
          .trim();

        // Strip trailing ellipsis — then find last clean sentence boundary
        if (/\.{2,}\s*$|…\s*$/.test(summary)) {
          summary = summary.replace(/\.{2,}\s*$|…\s*$/g, "").trim();
          // truncate back to last sentence-ending punctuation
          const lastStop = Math.max(
            summary.lastIndexOf(". "),
            summary.lastIndexOf("! "),
            summary.lastIndexOf("? "),
          );
          if (lastStop > 80) summary = summary.substring(0, lastStop + 1).trim();
          else summary = ""; // nothing salvageable
        }

        const wc = countWords(summary);
        const sentences = countSentences(summary);
        const lastChar = summary.slice(-1);
        const endsCleanly = /[.!?"']/.test(lastChar);

        // Allow a small tolerance around the locked 50-60 word target.
        const tooShort = wc < 45;
        const tooLong = wc > 65;
        const tooFewSentences = sentences < 2;
        const malformed = summary.startsWith("http") || !endsCleanly;

        if (tooShort || tooLong || tooFewSentences || malformed) {
          const reason = tooShort ? `short ${wc}w` : tooLong ? `long ${wc}w` : tooFewSentences ? `${sentences}s only` : "malformed";
          console.warn(`  [retry ${totalRetries}] ${model}: rejected (${reason}) — retrying`);
          continue;
        }

        const tags = sanitizeTopicTags(parsed.tags);
        if (tags.length !== 2) {
          console.warn(`  [retry ${totalRetries}] ${model}: summary accepted with ${tags.length}/2 topic tags; grounded headline repair will complete them`);
        }

        const gameTags = (Array.isArray(parsed.gameTags) ? parsed.gameTags as unknown[] : [])
          .filter((t): t is string => typeof t === "string" && t.length > 1 && t.length < 40)
          .slice(0, 3);

        console.log(`  ok ${wc}w ${sentences}s after ${totalRetries} attempt(s) (${model}) gameTags: [${gameTags.join(", ")}] tags: [${tags.join(", ")}]`);
        return { summary, gameTags, tags };

      } catch (err) {
        console.warn(`  [retry ${totalRetries}] Groq error (${model}):`, err);
      }
    }
  }
  console.warn(`  Quality gate failed after ${totalRetries} attempts — skipping (will retry next run)`);
  // Never fall back to raw scraped content as a summary — that produces garbage.
  // Skip the article; it will be retried on the next pipeline run.
  return { summary: "", gameTags: [], tags: [], rateLimited: sawRateLimit };
}

async function summarizeArticle(title: string, content: string): Promise<SummarizeResult> {
  const geminiResult = await summarizeWithGemini(title, content);
  if (geminiResult.summary) return geminiResult;
  console.warn("  Gemini did not return a usable summary — trying Groq backup");
  return await summarizeWithGroq(title, content);
}

const VIDEO_SYSTEM_PROMPT = talusSystemPrompt(`Write compact Talus news cards for newly released gaming videos, including trailers, reviews, technical analysis, news roundups, and commentary.
Return ONLY valid JSON with exactly these keys:
{"headline":"A clean, factual headline","summary":"2 or 3 concise sentences","gameTags":["GameTitle"],"tags":["PrimaryTopic","SecondaryEntity"]}

Rules:
- Preserve the actual game name and content type. Do not invent features, dates, platforms, verdicts, or claims.
- Headline: 6-14 words. State the video's main newsworthy point, not merely that a creator uploaded a video.
- Summary: 40-60 words and 2-3 complete sentences. Attribute opinions or recommendations to the creator and separate them from verified facts.
- Use no rhetorical questions, exclamation points, em dashes, or filler transitions.
- gameTags: game titles only, PascalCase, maximum 3.
- tags: exactly 2 specific named entities supported by the source.
- The first tag MUST be the primary game title or gaming topic and match gameTags[0].
- The second tag must be a named character, studio/publisher, platform, collaboration, or event explicitly present in the title/source.
- Never use a genre, mood, mechanic, or broad description as a tag (examples to avoid: Roguelike, Historical, ActionAdventure, CardGame, SurvivalHorror).`);

const VIDEO_GENERIC_TAGS = new Set([
  ...BANNED_TOPIC_TAGS,
  "actionadventure", "historical", "retrofuturistic", "cardgame", "roguelike",
  "survivalhorror", "retromode", "narrativesimulator", "crimegame",
  "spacesimulation", "battleroyale", "mobilegame", "cinematic", "officialtrailer",
]);

function toPascalEntity(value: string): string {
  return value
    .replace(/^#+/, "")
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
    .slice(0, 39);
}

const TITLE_ENTITY_BREAK_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "is", "its", "of", "on", "or", "the", "to", "with",
  "adds", "after", "before", "best", "big", "could", "does", "free", "gets", "has", "have", "how", "launch", "launches",
  "latest", "leads", "meets", "new", "news", "now", "official", "offers", "players", "reportedly", "reveals", "says", "studio",
  "thanks", "top", "update", "updates", "why", "will",
]);

function groundedTitleTags(title: string): string[] {
  const words = title.match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) ?? [];
  const candidates: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const candidate = toPascalEntity(run.slice(0, 4).join(" "));
    if (candidate.length > 1 && !BANNED_TOPIC_TAGS.has(candidate.toLowerCase())) candidates.push(candidate);
    run = [];
  };

  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    const looksNamed = /^[A-Z0-9]/.test(word) || /^[A-Z0-9]{2,}$/.test(word.replace(/[^A-Za-z0-9]/g, ""));
    if (!normalized || TITLE_ENTITY_BREAK_WORDS.has(normalized) || !looksNamed) {
      flush();
      continue;
    }
    run.push(word);
  }
  flush();
  return candidates;
}

function completeGroundedTopicTags(title: string, gameTags: string[], aiTags: string[]): string[] {
  // Every repair candidate is traceable to either the model's explicit game
  // extraction or literal headline text. No generic or fabricated tag is used.
  return sanitizeTopicTags([
    ...aiTags,
    ...gameTags,
    ...groundedTitleTags(title),
  ]);
}

function parseVideoSummary(
  raw: string,
  fallbackTitle: string,
  fallbackSource: string,
  provider: string,
): SummarizeResult | null {
  const parsed = extractJsonObject(raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim());
  if (!parsed) return null;
  const headline = String(parsed.headline ?? fallbackTitle).replace(/\s+/g, " ").trim().slice(0, 140);
  const summary = String(parsed.summary ?? "").replace(/\s+/g, " ").trim();
  const gameTags = (Array.isArray(parsed.gameTags) ? parsed.gameTags : [])
    .filter((tag): tag is string => typeof tag === "string")
    .map(toPascalEntity)
    .filter((tag, index, values) => tag.length > 1 && values.indexOf(tag) === index)
    .slice(0, 3);
  if (gameTags.length === 0) return null;
  const primaryTag = gameTags[0];
  const primaryKey = primaryTag.toLowerCase();
  const suggestedTags = (Array.isArray(parsed.tags) ? parsed.tags : [])
    .filter((tag): tag is string => typeof tag === "string")
    .map(toPascalEntity)
    .filter((tag) =>
      tag.length > 1
      && tag.toLowerCase() !== primaryKey
      && !primaryKey.includes(tag.toLowerCase())
      && !tag.toLowerCase().includes(primaryKey)
      && !VIDEO_GENERIC_TAGS.has(tag.toLowerCase())
    );
  const secondaryTag = gameTags.find((tag) => tag !== primaryTag)
    || suggestedTags[0]
    || toPascalEntity(fallbackSource);
  const tags = [primaryTag, secondaryTag];
  const words = countWords(summary);
  if (!headline || words < 35 || words > 65 || countSentences(summary) < 2) {
    console.warn(`  ${provider} video result rejected (${words}w, ${tags.length} tags)`);
    return null;
  }
  return { headline, summary, tags, gameTags };
}

async function summarizeVideo(
  title: string,
  description: string,
  transcript: string,
  source: string,
): Promise<SummarizeResult> {
  const sourceText = (transcript || description || title).slice(0, 5000);
  const userPrompt = `Channel: ${source}\nVideo title: ${title}\n\nSource text:\n${sourceText}\n\nCreate the compact gaming news card JSON.`;

  try {
    const contentJson = await generateGeminiJson(
      VIDEO_SYSTEM_PROMPT,
      userPrompt,
      { maxOutputTokens: 900, timeoutMs: 60_000, service: "news-ingestion", operation: "summarize-video" },
    );
    const parsed = parseVideoSummary(contentJson, title, source, "Gemini");
    if (parsed) return parsed;
  } catch (error) {
    console.warn("  Gemini video summary error:", error);
  }

  if (GROQ_API_KEY) {
    for (const model of MODELS) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: VIDEO_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 500,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const parsed = parseVideoSummary(payload.choices?.[0]?.message?.content ?? "", title, source, `Groq ${model}`);
        if (parsed) return parsed;
      } catch (error) {
        console.warn(`  Groq video summary error (${model}):`, error);
      }
    }
  }

  return { headline: title, summary: "", gameTags: [], tags: [] };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Lightweight keep-alive / health-check endpoint for the warm-up cron.
  if (req.method === "GET") {
    const { count, error } = await supabase
      .from("cached_articles")
      .select("*", { count: "exact", head: true });
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, cachedArticles: count ?? 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("=== fetch-news pipeline starting ===");

  let requestedSources: string[] = [];
  let diagnosticOnly = false;
  try {
    const payload = await req.clone().json();
    if (Array.isArray(payload?.sources)) {
      requestedSources = payload.sources.filter((value: unknown): value is string => typeof value === "string");
    }
    diagnosticOnly = payload?.diagnosticOnly === true;
  } catch {
    // Cron calls may omit a JSON body.
  }
  const { data: rssSourceRows, error: rssSourceError } = await supabase
    .from("news_rss_sources")
    .select("id, source_name, rss_url, daily_quota, min_quota, max_quota, last_seen_at, last_seen_article_url")
    .eq("active", true)
    .order("display_order", { ascending: true });
  if (rssSourceError) console.warn(`  RSS source config error; using bundled fallback: ${rssSourceError.message}`);
  const configuredFeeds: RssSourceConfig[] = rssSourceRows?.length
    ? rssSourceRows.map((row) => ({
        id: row.id,
        source: row.source_name,
        url: row.rss_url,
        dailyQuota: row.daily_quota,
        minQuota: row.min_quota,
        maxQuota: row.max_quota,
        lastSeenAt: row.last_seen_at,
        lastSeenArticleUrl: row.last_seen_article_url,
      }))
    : RSS_FEEDS;
  const selectedFeeds = requestedSources.length
    ? configuredFeeds.filter((feed) => requestedSources.includes(feed.source))
    : configuredFeeds;
  const { data: youtubeSourceRows, error: youtubeSourceError } = await supabase
    .from("youtube_content_sources")
    .select("*")
    .eq("active", true);
  if (youtubeSourceError) console.warn(`  YouTube source config error: ${youtubeSourceError.message}`);

  const now = Date.now();
  const selectedYouTubeSources = ((youtubeSourceRows ?? []) as YouTubeSource[]).filter((source) => {
    if (requestedSources.length && !requestedSources.includes(source.source_name)) return false;
    if (requestedSources.includes(source.source_name)) return true;
    if (!source.last_polled_at) return true;
    return now - new Date(source.last_polled_at).getTime() >= source.poll_interval_minutes * 60_000;
  });

  // Step 1: Fetch all RSS feeds in parallel (each with its own 10s timeout)
  // so wall-clock time stays ~10s regardless of how many feeds we add.
  const feedResults = await Promise.allSettled(
    selectedFeeds.map(async (feed, feedIndex): Promise<FeedFetchResult> => {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      try {
        // Bing returns a tiny HTML throttle page when both Sportskeeda searches
        // hit it simultaneously. Stagger only duplicate Bing requests.
        const earlierBingFeeds = selectedFeeds.slice(0, feedIndex)
          .filter((candidate) => candidate.url.includes("bing.com/news/search")).length;
        if (feed.url.includes("bing.com/news/search") && earlierBingFeeds > 0) {
          await new Promise((resolve) => setTimeout(resolve, earlierBingFeeds * 1000));
        }
        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });
        if (!res.ok) {
          console.warn(`  RSS ${feed.source}: HTTP ${res.status}`);
          return { items: [], status: res.status, contentType: res.headers.get("content-type") ?? "", bytes: 0, rawItemTags: 0, preview: "", error: `HTTP ${res.status}` };
        }
        const xml = await res.text();
        const items = parseRSSItems(xml, feed.source);
        console.log(`  ${feed.source}: ${items.length} items`);
        return {
          items,
          status: res.status,
          contentType: res.headers.get("content-type") ?? "",
          bytes: xml.length,
          rawItemTags: (xml.match(/<(?:item|entry)[\s>]/gi) ?? []).length,
          preview: xml.slice(0, 120).replace(/\s+/g, " "),
          error: null,
        };
      } catch (e) {
        console.warn(`  RSS ${feed.source}: ${e}`);
        return { items: [], status: null, contentType: "", bytes: 0, rawItemTags: 0, preview: "", error: String(e) };
      } finally {
        clearTimeout(tid);
      }
    })
  );
  const fetchedRssItems: RssItem[] = feedResults.flatMap((r) =>
    r.status === "fulfilled" ? r.value.items : []
  );
  const ingestionCutoffMs = Date.now() - INGESTION_WINDOW_MS;
  const ingestionFutureToleranceMs = Date.now() + 15 * 60 * 1000;
  const rssItems = fetchedRssItems.filter((item) => {
    const publishedAt = Date.parse(item.pubDate);
    return Number.isFinite(publishedAt)
      && publishedAt >= ingestionCutoffMs
      && publishedAt <= ingestionFutureToleranceMs;
  });
  const rssOutsideWindow = fetchedRssItems.length - rssItems.length;
  if (rssOutsideWindow > 0) {
    console.log(`  Rolling window rejected ${rssOutsideWindow} RSS items published outside the last 24 hours`);
  }
  const youtubeResults = await Promise.all(
    selectedYouTubeSources.map(async (source) => {
      const result = await fetchYouTubeUploads(source);
      const today = new Date().toISOString().slice(0, 10);
      const previousUnits = source.quota_date === today ? source.quota_units_used_today : 0;
      const { error: updateError } = await supabase
        .from("youtube_content_sources")
        .update({
          quota_date: today,
          quota_units_used_today: previousUnits + result.quotaUnits,
          updated_at: new Date().toISOString(),
        })
        .eq("id", source.id);
      if (updateError) console.warn(`  YouTube source-state update failed: ${updateError.message}`);
      return { source, result };
    })
  );
  const youtubeItems = youtubeResults.flatMap(({ result }) => result.items);
  const fetchedAllItems: RssItem[] = [...rssItems, ...youtubeItems];
  const feedStats = [...feedResults.map((result, index) => ({
    source: selectedFeeds[index].source,
    url: selectedFeeds[index].url,
    items: result.status === "fulfilled" ? result.value.items.length : 0,
    status: result.status === "fulfilled" ? result.value.status : null,
    contentType: result.status === "fulfilled" ? result.value.contentType : "",
    bytes: result.status === "fulfilled" ? result.value.bytes : 0,
    rawItemTags: result.status === "fulfilled" ? result.value.rawItemTags : 0,
    preview: result.status === "fulfilled" ? result.value.preview : "",
    error: result.status === "fulfilled" ? result.value.error : String(result.reason),
    type: "rss",
  })), ...youtubeResults.map(({ source, result }) => ({
    source: source.source_name,
    url: source.channel_url,
    items: result.items.length,
    status: result.error ? null : 200,
    contentType: result.mode,
    bytes: 0,
    rawItemTags: result.items.length,
    preview: `${result.quotaUnits} quota units`,
    error: result.error,
    type: "youtube",
  }))];

  if (diagnosticOnly) {
    return new Response(JSON.stringify({
      total: fetchedAllItems.length,
      rollingWindowHours: 24,
      freshRssItems: rssItems.length,
      rssOutsideWindow,
      youtubeItems: youtubeItems.length,
      feeds: feedStats,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Persist newly discovered RSS items before advancing source checkpoints.
  // This small inbox is what lets a three-slot run defer the fourth story
  // without losing it when last_seen_at moves forward.
  const newlyDiscoveredRss = rssItems.filter((item) => {
    const source = configuredFeeds.find((candidate) => candidate.source === item.source);
    const lastSeenMs = Date.parse(source?.lastSeenAt ?? "");
    const publishedMs = Date.parse(item.pubDate);
    return !Number.isFinite(lastSeenMs) || !Number.isFinite(publishedMs) || publishedMs > lastSeenMs;
  });
  let rssCheckpointStored = true;
  if (newlyDiscoveredRss.length > 0) {
    const sourceIds = new Map(configuredFeeds.map((source) => [source.source, source.id]));
    const { error: candidateInsertError } = await supabase
      .from("news_source_candidates")
      .upsert(newlyDiscoveredRss.map((item) => ({
        source_id: sourceIds.get(item.source),
        source_name: item.source,
        source_url: item.link,
        title: item.title,
        published_at: item.pubDate,
        author: item.author,
        description: item.description,
        enclosure_url: item.enclosureUrl,
        status: "pending",
      })), { onConflict: "source_url", ignoreDuplicates: true });
    if (candidateInsertError) {
      rssCheckpointStored = false;
      console.warn(`  RSS candidate checkpoint failed: ${candidateInsertError.message}`);
    }
  }

  const queueCutoff = new Date(Date.now() - INGESTION_WINDOW_MS).toISOString();
  await supabase
    .from("news_source_candidates")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("published_at", queueCutoff);

  let queuedRssItems = rssItems;
  if (rssCheckpointStored && selectedFeeds.length > 0) {
    const { data: pendingRows, error: pendingError } = await supabase
      .from("news_source_candidates")
      .select("source_name, source_url, title, published_at, author, description, enclosure_url")
      .in("source_id", selectedFeeds.map((source) => source.id))
      .eq("status", "pending")
      .gte("published_at", queueCutoff)
      .order("published_at", { ascending: true })
      .limit(500);
    if (pendingError) {
      rssCheckpointStored = false;
      console.warn(`  RSS pending queue unavailable: ${pendingError.message}`);
    } else {
      queuedRssItems = (pendingRows ?? []).map((row) => ({
        title: row.title,
        link: row.source_url,
        pubDate: row.published_at,
        author: row.author || "Staff Writer",
        description: row.description || "",
        enclosureUrl: row.enclosure_url,
        source: row.source_name,
      }));
    }
  }
  const allItems: RssItem[] = [...queuedRssItems, ...youtubeItems];

  // Step 2: Filter out already-cached articles (news is permanent)
  const urls = allItems.map(i => i.link);
  const existingResult = urls.length > 0
    ? await supabase
      .from("cached_articles")
      .select("source_url, ai_summary, summary, media_type")
      .in("source_url", urls)
    : { data: [], error: null };
  const existing = existingResult.data;

  // Old esports ingestion copied tiny RSS teasers straight into the card.
  // Treat those rows as unfinished so the unified scrape + AI pipeline can
  // replace them instead of preserving a one-line placeholder forever.
  const existingUrls = new Set(
    (existing ?? []).filter(cachedArticleIsPublishReady).map(e => e.source_url),
  );
  const { data: recentTitles } = await supabase
    .from("cached_articles")
    .select("title, ai_title, ai_summary, summary, media_type")
    .gte("article_date", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());
  const dedupTitles = (recentTitles ?? []).filter(cachedArticleIsPublishReady).flatMap((row) =>
    [row.ai_title, row.title].filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const uncachedRss = queuedRssItems.filter((item) => !existingUrls.has(item.link));
  const uncachedYouTube = youtubeItems.filter((item) => !existingUrls.has(item.link));
  const rssDedupe = deduplicateCandidates(uncachedRss, dedupTitles);
  const youtubeDedupe = deduplicateCandidates(uncachedYouTube, dedupTitles);

  if (rssCheckpointStored) {
    const resolvedUrls = [...existingUrls].filter((url) => queuedRssItems.some((item) => item.link === url));
    if (resolvedUrls.length > 0) {
      await supabase
        .from("news_source_candidates")
        .update({ status: "published", resolved_at: new Date().toISOString() })
        .in("source_url", resolvedUrls);
    }
    if (rssDedupe.duplicateUrls.length > 0) {
      await supabase
        .from("news_source_candidates")
        .update({ status: "duplicate", resolved_at: new Date().toISOString() })
        .in("source_url", rssDedupe.duplicateUrls);
    }
  }

  const { data: pacingRows, error: pacingError } = await supabase.rpc("claim_news_pacing_slot", {
    p_requested: Math.min(rssDedupe.items.length, ARTICLE_PROCESS_LIMIT),
  });
  const pacing = Array.isArray(pacingRows) ? pacingRows[0] : pacingRows;
  const pacingFallback = Boolean(pacingError || !pacing);
  if (pacingFallback) {
    console.warn(`  News pacing slot unavailable; publishing no website articles: ${pacingError?.message ?? "empty response"}`);
  }
  const pacedArticleSlots = pacingFallback ? 0 : Math.max(0, Number(pacing.granted_allowance) || 0);
  const dailyBudget = pacingFallback ? ROLLING_ARTICLE_CAP : Math.max(0, Number(pacing.daily_budget) || ROLLING_ARTICLE_CAP);
  const publishedToday = pacingFallback ? 0 : Math.max(0, Number(pacing.daily_published_before) || 0);
  const remainingArticleSlots = Math.max(0, dailyBudget - publishedToday);
  const pacingSlotStartedAt = pacingFallback ? null : (pacing.slot_started_at as string | null);
  const localDayStart = pacingFallback ? new Date(Date.now() - INGESTION_WINDOW_MS).toISOString() : pacing.local_day_start;
  const localDayEnd = pacingFallback ? new Date(Date.now() + INGESTION_WINDOW_MS).toISOString() : pacing.local_day_end;
  const configuredRssSourceNames = configuredFeeds.map((source) => source.source);
  const { data: dailyArticleRows, error: dailyArticleError } = await supabase
    .from("cached_articles")
    .select("source")
    .eq("media_type", "article")
    .in("source", configuredRssSourceNames)
    .gte("fetched_at", localDayStart)
    .lt("fetched_at", localDayEnd);
  if (dailyArticleError) console.warn(`  Daily article allocation query failed: ${dailyArticleError.message}`);
  const alreadyPublishedBySource: Record<string, number> = {};
  for (const row of dailyArticleRows ?? []) {
    alreadyPublishedBySource[row.source] = (alreadyPublishedBySource[row.source] ?? 0) + 1;
  }
  const allocation = allocateArticleSlots(
    rssDedupe.items,
    selectedFeeds,
    pacedArticleSlots,
    alreadyPublishedBySource,
  );

  // YouTube is deliberately outside the 100-article daily website budget. Every fresh
  // 24-hour video remains eligible; only RSS candidates enter allocation.
  const youtubeQueue = interleaveBySource(youtubeDedupe.items);
  const articleQueue = allocation.items;
  const newItems = [...articleQueue, ...youtubeQueue];
  const similarityDuplicateCount = rssDedupe.duplicateCount + youtubeDedupe.duplicateCount;
  const duplicateCount = existingUrls.size + similarityDuplicateCount;
  if (existingUrls.size > 0) console.log(`  Cache gate removed ${existingUrls.size} previously published URLs`);
  if (similarityDuplicateCount > 0) console.log(`  Similarity gate removed ${similarityDuplicateCount} duplicate candidates`);
  console.log(
    `  RSS pacing: ${pacing?.band_name ?? "unavailable"} band, `
    + `${publishedToday}/${dailyBudget} published today, `
    + `slot allowance ${pacedArticleSlots}, ${allocation.items.length} allocated`,
  );
  for (const source of selectedFeeds) {
    const allocated = allocation.allocatedBySource[source.source] ?? 0;
    const candidates = allocation.candidateCountBySource[source.source] ?? 0;
    console.log(`  [ALLOCATION] ${source.source}: ${allocated} allocated from ${candidates} candidates`);
  }
  console.log(`${existingUrls.size} already cached, ${newItems.length} allocated items to process`);
  // Step 3: Scrape all new articles in parallel
  interface EnrichedItem extends RssItem {
    content: string;
    imageUrl: string;
    ogImage: string | null;
    scrapeMethod: string;
  }

  const enrichedItems: EnrichedItem[] = [];

  // Reserve independent scrape capacity for each pipeline. A busy YouTube day
  // must never prevent allocated website articles from reaching summarization.
  const scrapeCandidates = [
    ...articleQueue.slice(0, ARTICLE_SCRAPE_LIMIT),
    ...youtubeQueue.slice(0, YOUTUBE_SCRAPE_LIMIT),
  ];
  const scrapeResults = await Promise.allSettled(
    scrapeCandidates.map(async (item) => {
      const rssDesc = removeBoilerplate(stripHtml(item.description));
      const rssWords = rssDesc.split(/\s+/).filter(Boolean).length;

      let content: string;
      let scrapedImage: string | null = null;
      let scrapeMethod = "rss";

      if (item.mediaType === "youtube" && item.videoId) {
        const transcript = await fetchYouTubeTranscript(item.videoId);
        content = transcript || rssDesc || item.title;
        scrapedImage = item.enclosureUrl;
        scrapeMethod = transcript ? "youtube-transcript" : "youtube-metadata";
        console.log(`  [${item.source}] transcript ${transcript ? "available" : "unavailable; using title/description"}`);
      } else if (rssWords >= 120) {
        content = rssDesc;
      } else {
        const scraped = await scrapeArticle(item.link);
        scrapedImage = scraped.ogImage;
        scrapeMethod = scraped.method;
        content = scraped.text.length > 100
          ? scraped.text
          : (rssWords > 5 ? rssDesc : item.title);
      }

      const imageUrl = item.enclosureUrl ?? scrapedImage ?? "";
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      console.log(`  [${item.source}] "${item.title.substring(0, 50)}..." — ${scrapeMethod} -> ${wordCount}w`);

      return { ...item, content, imageUrl, ogImage: scrapedImage, scrapeMethod };
    })
  );

  for (const result of scrapeResults) {
    if (result.status === "fulfilled") {
      enrichedItems.push(result.value);
    } else {
      console.error(`Scrape failed for an article:`, result.reason);
    }
  }

  console.log(`Scraped ${enrichedItems.length}/${newItems.length} articles successfully`);

  // Step 4: bounded concurrent summarization. Three simultaneous items keeps
  // provider pressure modest while avoiding the previous four-card/run stall.
  // News is permanent — no artificial expiry.
  const expiresAt = new Date('2099-12-31T23:59:59.000Z');
  let processed = 0;
  let processedArticles = 0;
  let processedYouTube = 0;
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string) => { skipReasons[reason] = (skipReasons[reason] || 0) + 1; };

  // Stop processing when we get close to Supabase's 150s edge-function
  // wall-time limit — unprocessed articles are picked up on the next run.
  const pipelineStart = Date.now();
  const TIME_BUDGET_MS = 110_000;
  const enrichedArticles = enrichedItems.filter((item) => item.mediaType !== "youtube");
  const enrichedYouTube = enrichedItems.filter((item) => item.mediaType === "youtube");
  const itemsToProcess = [
    ...enrichedArticles.slice(0, ARTICLE_PROCESS_LIMIT),
    ...enrichedYouTube.slice(0, YOUTUBE_PROCESS_LIMIT),
  ];
  console.log(
    `Processing ${itemsToProcess.length}/${enrichedItems.length} items `
    + `(RSS ${Math.min(enrichedArticles.length, ARTICLE_PROCESS_LIMIT)}, YouTube ${Math.min(enrichedYouTube.length, YOUTUBE_PROCESS_LIMIT)})`,
  );
  const processedBySource: Record<string, number> = {};

  type ProcessOutcome = "published" | "rate_limited" | "skipped";
  const processItem = async (item: EnrichedItem): Promise<ProcessOutcome> => {
    try {
      const summaryResult = item.mediaType === "youtube"
        ? await summarizeVideo(item.title, item.description, item.content, item.source)
        : await summarizeArticle(item.title, item.content);
      const { headline } = summaryResult;
      let { summary, gameTags, tags, rateLimited } = summaryResult;

      if (!summary) {
        const sourceExcerpt = buildSourceExcerpt(item.content);
        if (sourceExcerpt) {
          summary = sourceExcerpt;
          gameTags = [];
          tags = [];
          rateLimited = false;
          console.log(`  using clean source excerpt (${countWords(summary)}w)`);
        }
      }

      tags = completeGroundedTopicTags(item.title, gameTags, tags);

      // A publish-ready Talus article must have two specific, content-derived
      // hashtags. If the AI provider is unavailable or returns generic/invalid
      // topics, defer the article rather than showing fabricated fallback tags.
      if (tags.length !== 2) {
        skip("topic_tags");
        console.warn(`  Skipping "${item.title}" — exactly two verified topic tags are required`);
        return "skipped";
      }

      const minimumSummaryLength = item.mediaType === "youtube" ? 60 : 100;
      if (!summary || summary.length < minimumSummaryLength) {
        if (rateLimited) {
          skip("rate_limited");
        } else {
          skip(countWords(item.content) < 15 ? "thin_content" : "quality_gate");
        }
        console.warn(`  Skipping "${item.title}" — summary failed, will retry next run`);
        return rateLimited ? "rate_limited" : "skipped";
      }

      const { error } = await supabase.from("cached_articles").upsert({
        original_id:  item.mediaType === "youtube" && item.videoId
          ? `youtube-${item.videoId}`
          : `${item.source}-${item.link.substring(item.link.length - 60)}`,
        title:        item.title,
        summary,
        source_url:   item.link,
        image_url:    item.imageUrl,
        og_image_url: item.ogImage,
        category:     ["Esports Insider", "Sheep Esports", "Dot Esports", "HLTV", "VLR"].includes(item.source)
          ? "esports"
          : "Gaming",
        source:       item.source,
        author:       item.author,
        ai_title:     headline || item.title,
        ai_summary:   summary,
        game_tags:    gameTags,
        tags,
        likes:        0,
        media_type:   item.mediaType || "article",
        video_id:     item.videoId || null,
        duplicate_flag: false,
        report_count: 0,
        article_date: (() => { try { return new Date(item.pubDate).toISOString(); } catch { return new Date().toISOString(); } })(),
        expires_at:   expiresAt.toISOString(),
      }, { onConflict: "source_url" });

      if (error) {
        console.error(`DB upsert error for "${item.title}":`, error);
        skip("database");
        return "skipped";
      }

      if (item.mediaType !== "youtube" && rssCheckpointStored) {
        const { error: queueResolveError } = await supabase
          .from("news_source_candidates")
          .update({ status: "published", resolved_at: new Date().toISOString() })
          .eq("source_url", item.link);
        if (queueResolveError) {
          console.warn(`  RSS candidate resolution failed for "${item.title}": ${queueResolveError.message}`);
        }
      }

      processed++;
      if (item.mediaType === "youtube") processedYouTube++;
      else processedArticles++;
      processedBySource[item.source] = (processedBySource[item.source] || 0) + 1;
      return "published";
    } catch (err) {
      console.error(`Error processing "${item.title}":`, err);
      skip("processing_error");
      return "skipped";
    }
  };

  for (let offset = 0; offset < itemsToProcess.length; offset += PROCESS_CONCURRENCY) {
    if (Date.now() - pipelineStart > TIME_BUDGET_MS) {
      console.warn(`  Time budget exhausted — deferring remaining items to next run`);
      skip("time_budget");
      break;
    }

    const batch = itemsToProcess.slice(offset, offset + PROCESS_CONCURRENCY);
    const outcomes = await Promise.all(batch.map(processItem));
    if (outcomes.every((outcome) => outcome === "rate_limited")) {
      console.warn(`  Entire batch was rate limited — stopping early for the next run`);
      break;
    }

    // A short batch pause smooths request bursts without serializing the work.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const usageDate = new Date().toISOString().slice(0, 10);
  const { data: existingUsageRows } = await supabase
    .from("news_source_daily_usage")
    .select("source_id, fetched_count, candidate_count, allocated_count, published_count, duplicate_count, near_miss_count")
    .eq("run_date", usageDate);
  const existingUsage = new Map((existingUsageRows ?? []).map((row) => [row.source_id, row]));
  const sourceUsageRows = selectedFeeds.map((source, index) => ({
    ...(existingUsage.get(source.id) ?? {}),
    run_date: usageDate,
    source_id: source.id,
    source_name: source.source,
    fetched_count: Number(existingUsage.get(source.id)?.fetched_count ?? 0)
      + (feedResults[index]?.status === "fulfilled" ? feedResults[index].value.items.length : 0),
    candidate_count: Number(existingUsage.get(source.id)?.candidate_count ?? 0)
      + (allocation.candidateCountBySource[source.source] ?? 0),
    allocated_count: Number(existingUsage.get(source.id)?.allocated_count ?? 0)
      + (allocation.allocatedBySource[source.source] ?? 0),
    published_count: Number(existingUsage.get(source.id)?.published_count ?? 0)
      + (processedBySource[source.source] ?? 0),
    duplicate_count: Number(existingUsage.get(source.id)?.duplicate_count ?? 0)
      + (rssDedupe.duplicatesBySource[source.source] ?? 0),
    near_miss_count: Number(existingUsage.get(source.id)?.near_miss_count ?? 0)
      + (rssDedupe.nearMissesBySource[source.source] ?? 0),
    updated_at: new Date().toISOString(),
  }));
  if (sourceUsageRows.length > 0) {
    const { error: usageError } = await supabase
      .from("news_source_daily_usage")
      .upsert(sourceUsageRows, { onConflict: "run_date,source_id" });
    if (usageError) console.warn(`  Daily source-allocation log failed: ${usageError.message}`);
  }

  if (pacingSlotStartedAt) {
    const { error: pacingCompletionError } = await supabase
      .from("news_pacing_runs")
      .update({
        published_count: processedArticles,
        completed_at: new Date().toISOString(),
      })
      .eq("slot_started_at", pacingSlotStartedAt);
    if (pacingCompletionError) {
      console.warn(`  News pacing completion log failed: ${pacingCompletionError.message}`);
    }
  }

  // Advance RSS checkpoints only after every newly observed item is safely in
  // the persistent candidate inbox. Pending candidates survive for later runs.
  const sourceCheckTime = new Date().toISOString();
  let sourceCheckpointsUpdated = 0;
  for (let index = 0; index < selectedFeeds.length; index++) {
    const source = selectedFeeds[index];
    const result = feedResults[index];
    const successful = result?.status === "fulfilled" && !result.value.error;
    const update: Record<string, string | null> = {
      last_checked_at: sourceCheckTime,
      last_check_error: successful
        ? null
        : result?.status === "fulfilled" ? result.value.error : String(result?.reason ?? "RSS fetch failed"),
    };
    if (successful) {
      update.last_successful_check_at = sourceCheckTime;
      if (rssCheckpointStored && result.value.items.length > 0) {
        const newest = result.value.items.reduce((latest, item) => {
          const publishedMs = Date.parse(item.pubDate);
          return Number.isFinite(publishedMs) && publishedMs > latest.publishedMs
            ? { publishedMs, url: item.link }
            : latest;
        }, {
          publishedMs: Date.parse(source.lastSeenAt ?? "") || 0,
          url: source.lastSeenArticleUrl ?? "",
        });
        if (newest.publishedMs > 0) {
          update.last_seen_at = new Date(newest.publishedMs).toISOString();
          update.last_seen_article_url = newest.url;
        }
      }
    }
    const { error: sourceCheckpointError } = await supabase
      .from("news_rss_sources")
      .update(update)
      .eq("id", source.id);
    if (sourceCheckpointError) {
      console.warn(`  ${source.source}: checkpoint update failed: ${sourceCheckpointError.message}`);
    } else {
      sourceCheckpointsUpdated++;
    }
  }

  // Mark a YouTube source fully polled only when every candidate still inside
  // its 24-hour window has reached cached_articles. If the edge-function time
  // budget deferred any videos, leaving last_polled_at unchanged makes the
  // next 30-minute cron pick the source up again instead of discarding them.
  for (const { source, result } of youtubeResults) {
    if (result.error) continue;
    const candidateUrls = [...new Set(result.items.map((item) => item.link))];
    let drained = candidateUrls.length === 0;
    if (candidateUrls.length > 0) {
      const { count, error: drainCheckError } = await supabase
        .from("cached_articles")
        .select("source_url", { count: "exact", head: true })
        .in("source_url", candidateUrls);
      if (drainCheckError) {
        console.warn(`  ${source.source_name} drain check failed: ${drainCheckError.message}`);
      } else {
        drained = (count ?? 0) === candidateUrls.length;
      }
    }
    if (!drained) {
      console.log(`  ${source.source_name}: fresh-video queue not drained; retrying next cron`);
      continue;
    }
    const { error: pollStateError } = await supabase
      .from("youtube_content_sources")
      .update({
        last_polled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id);
    if (pollStateError) {
      console.warn(`  ${source.source_name} poll-state update failed: ${pollStateError.message}`);
    }
  }

  console.log(`=== Done: ${processed}/${itemsToProcess.length} new articles processed ===`);

  return new Response(JSON.stringify({
    total:     allItems.length,
    cached:    existingUrls.size,
    new:       newItems.length,
    scraped:   enrichedItems.length,
    processed,
    processedArticles,
    processedYouTube,
    articleBudget: {
      cap: dailyBudget,
      localDate: pacing?.local_date ?? null,
      timezone: pacing?.timezone_name ?? null,
      band: pacing?.band_name ?? null,
      slotStartedAt: pacingSlotStartedAt,
      configuredAllowance: pacingFallback ? 0 : Number(pacing.configured_allowance) || 0,
      alreadyClaimed: pacingFallback ? false : Boolean(pacing.already_claimed),
      publishedBeforeRun: publishedToday,
      remainingBeforeRun: remainingArticleSlots,
      pacedAllowance: pacedArticleSlots,
      pacingFallback,
      allocatedThisRun: allocation.items.length,
    },
    rssOutsideWindow,
    pendingRssCandidates: queuedRssItems.length,
    sourceCheckpointsUpdated,
    allocation: allocation.allocatedBySource,
    processedBySource,
    feeds: feedStats,
    youtube: youtubeResults.map(({ source, result }) => ({
      source: source.source_name,
      items: result.items.length,
      mode: result.mode,
      quotaUnits: result.quotaUnits,
      error: result.error,
    })),
    duplicatesFiltered: Math.max(duplicateCount, 0),
    skipped:   skipReasons,
    elapsedMs: Date.now() - pipelineStart,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
