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

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
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
    const responses = await Promise.all([1, 2].map(async (page) => {
      const url = new URL("https://api.rawg.io/api/games");
      url.searchParams.set("key", rawgKey);
      url.searchParams.set("dates", `${startDate},${endDate}`);
      url.searchParams.set("ordering", "-added");
      url.searchParams.set("page_size", "40");
      url.searchParams.set("page", String(page));
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`RAWG returned ${response.status}`);
      return response.json() as Promise<RawgResponse>;
    }));
    const results = [...new Map(responses.flatMap((response) => response.results).map((game) => [game.slug, game])).values()];
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ count: results.length, results });
  } catch (error) {
    console.error("Game Calendar API failed", error);
    return res.status(502).json({ error: "Release data is temporarily unavailable" });
  }
}
