interface VercelRequestLike {
  query: Record<string, string | string[] | undefined>;
}
interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  rating: number;
  ratings_count?: number;
  added?: number;
  metacritic: number | null;
  released: string | null;
  genres: Array<{ id: number; slug: string; name: string }>;
  platforms: Array<{ platform: { name: string } }> | null;
}

interface RawgResponse {
  count: number;
  results: RawgGame[];
  next: string | null;
}

interface FallbackGame {
  id: number;
  name: string;
  summary?: string;
  url?: string;
  cover?: { url?: string };
  genres?: Array<{ id: number; name: string }>;
  platform?: { slug?: string };
  date?: string;
  hypes?: number;
  follow?: number;
  total_rating?: number;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fallbackDate(value?: string): string | null {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function fallbackPlatform(slug?: string): string {
  const platforms: Record<string, string> = {
    win: "PC",
    linux: "Linux",
    mac: "macOS",
    ps4: "PlayStation 4",
    ps5: "PlayStation 5",
    xboxone: "Xbox One",
    "series-x-s": "Xbox Series S/X",
    switch: "Nintendo Switch",
    switch2: "Nintendo Switch 2",
    "switch-2": "Nintendo Switch 2",
    ios: "iOS",
    android: "Android",
  };
  return platforms[slug ?? ""] ?? slug ?? "Platform TBA";
}

function coverUrl(value?: string): string | null {
  if (!value) return null;
  const url = value.startsWith("//") ? `https:${value}` : value;
  return url.replace("/t_cover_big/", "/t_cover_big_2x/");
}

async function fetchRawg(startDate: string, endDate: string, rawgKey: string): Promise<RawgGame[]> {
  const responses = await Promise.all([1, 2].map(async (page) => {
    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", rawgKey);
    url.searchParams.set("dates", `${startDate},${endDate}`);
    url.searchParams.set("ordering", "-added");
    url.searchParams.set("page_size", "40");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(18_000) });
    if (!response.ok) throw new Error(`RAWG returned ${response.status}`);
    return response.json() as Promise<RawgResponse>;
  }));
  return [...new Map(responses.flatMap((response) => response.results).map((game) => [game.slug, game])).values()];
}

async function fetchGameCalendarFallback(startDate: string, endDate: string): Promise<RawgGame[]> {
  const response = await fetch("https://gamecalbff.sb-pro.fr/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ start_date: startDate, end_date: endDate, platform_ids: [], hypes: 0, score: false }),
    signal: AbortSignal.timeout(18_000),
  });
  if (!response.ok) throw new Error(`Fallback calendar returned ${response.status}`);
  const payload = await response.json() as FallbackGame[];
  const merged = new Map<string, RawgGame>();
  const sorted = payload
    .filter((game) => game.id && game.name && fallbackDate(game.date))
    .sort((a, b) => ((b.hypes ?? 0) * 5 + (b.follow ?? 0) + (b.total_rating ?? 0)) - ((a.hypes ?? 0) * 5 + (a.follow ?? 0) + (a.total_rating ?? 0)));

  for (const game of sorted) {
    const slug = game.url?.split("/games/")[1]?.split(/[?#/]/)[0] || slugify(game.name);
    const existing = merged.get(slug);
    const platform = { platform: { name: fallbackPlatform(game.platform?.slug) } };
    if (existing) {
      if (!existing.platforms?.some((item) => item.platform.name === platform.platform.name)) existing.platforms?.push(platform);
      continue;
    }
    const totalRating = Number(game.total_rating ?? 0);
    merged.set(slug, {
      id: game.id,
      slug,
      name: game.name,
      background_image: coverUrl(game.cover?.url),
      rating: totalRating > 0 ? Math.round((totalRating / 20) * 10) / 10 : 0,
      ratings_count: 0,
      added: Math.max(0, Number(game.hypes ?? 0) + Number(game.follow ?? 0)),
      metacritic: null,
      released: fallbackDate(game.date),
      genres: (game.genres ?? []).map((genre) => ({ id: genre.id, slug: slugify(genre.name), name: genre.name })),
      platforms: [platform],
    });
  }
  return [...merged.values()].slice(0, 80);
}

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  const startDate = first(req.query.startDate);
  const endDate = first(req.query.endDate);
  if (!isDate(startDate) || !isDate(endDate)) {
    return res.status(400).json({ error: "A valid release month is required" });
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const span = end.getTime() - start.getTime();
  const now = new Date();
  const earliest = Date.UTC(now.getUTCFullYear() - 5, 0, 1);
  const latest = Date.UTC(now.getUTCFullYear() + 5, 11, 31);
  if (span < 0 || span > 40 * 24 * 60 * 60 * 1000 || start.getTime() < earliest || end.getTime() > latest) {
    return res.status(400).json({ error: "The requested release window is not supported" });
  }

  const rawgKey = process.env.RAWG_API_KEY || process.env.VITE_RAWG_API_KEY;
  if (!rawgKey) return res.status(503).json({ error: "Release data is not configured" });

  try {
    let results: RawgGame[];
    let source = "RAWG";
    try {
      results = await fetchRawg(startDate, endDate, rawgKey);
    } catch (rawgError) {
      console.warn("RAWG calendar unavailable; using IGDB-backed fallback", rawgError);
      results = await fetchGameCalendarFallback(startDate, endDate);
      source = "IGDB fallback";
    }
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ count: results.length, results, source });
  } catch (error) {
    console.error("Game Calendar API failed", error);
    return res.status(502).json({ error: "Release data is temporarily unavailable" });
  }
}
