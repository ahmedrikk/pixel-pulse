interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

type GameRow = { id: string; updated_at: string | null };
type PatchRow = { game_id: string; seo_slug: string; updated_at: string };

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function isoDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function readTable<T>(baseUrl: string, key: string, table: string, query: URLSearchParams): Promise<T[]> {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`${table} returned ${response.status}`);
  return response.json() as Promise<T[]>;
}

export default async function handler(_request: unknown, response: VercelResponseLike) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://talus.social").replace(/\/$/, "");
  if (!supabaseUrl || !key) {
    response.status(503).send("Sitemap is temporarily unavailable");
    return;
  }

  try {
    const [games, patches] = await Promise.all([
      readTable<GameRow>(supabaseUrl, key, "games", new URLSearchParams({ select: "id,updated_at", order: "updated_at.desc", limit: "10000" })),
      readTable<PatchRow>(supabaseUrl, key, "game_patches", new URLSearchParams({ select: "game_id,seo_slug,updated_at", editorial_status: "eq.ready", order: "updated_at.desc", limit: "10000" })),
    ]);

    const urls = new Map<string, string | undefined>();
    const add = (path: string, modified?: string | null) => urls.set(path, isoDate(modified));
    ["/", "/esports", "/reviews", "/free-games", "/game-patch", "/game-calendar", "/terms", "/privacy", "/cookies", "/guidelines"].forEach((path) => add(path));
    games.forEach((game) => add(`/reviews/${encodeURIComponent(game.id)}`, game.updated_at));
    patches.forEach((patch) => {
      add(`/game-patch/${encodeURIComponent(patch.game_id)}`, patch.updated_at);
      add(`/game-patch/${encodeURIComponent(patch.game_id)}/${encodeURIComponent(patch.seo_slug)}`, patch.updated_at);
    });
    const now = new Date();
    for (let offset = 0; offset < 12; offset += 1) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      add(`/game-calendar?month=${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`);
    }

    const entries = [...urls.entries()].map(([path, lastmod]) => `\n  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`).join("");
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}\n</urlset>\n`;
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send(body);
  } catch (error) {
    console.error("Sitemap generation failed", error);
    response.status(502).send("Sitemap is temporarily unavailable");
  }
}
