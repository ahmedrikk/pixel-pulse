export const config = { runtime: "edge" };

const RAWG_BASE = "https://api.rawg.io/api";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const ALLOWED_ORDERING = new Set(["-rating", "rating", "-metacritic", "metacritic", "-added", "added", "-released", "released"]);

function json(body: unknown, status = 200, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache ? "public, s-maxage=1800, stale-while-revalidate=21600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return json({ error: "RAWG is not configured" }, 503);

  const requestUrl = new URL(req.url);
  const slug = requestUrl.searchParams.get("slug")?.trim();
  const upstream = new URL(slug ? `${RAWG_BASE}/games/${slug}` : `${RAWG_BASE}/games`);

  if (slug && !SLUG_PATTERN.test(slug)) return json({ error: "Invalid game slug" }, 400);

  upstream.searchParams.set("key", apiKey);
  if (!slug) {
    const page = Math.max(1, Math.min(1000, Number.parseInt(requestUrl.searchParams.get("page") || "1", 10) || 1));
    const pageSize = Math.max(1, Math.min(40, Number.parseInt(requestUrl.searchParams.get("page_size") || "20", 10) || 20));
    const search = requestUrl.searchParams.get("search")?.trim().slice(0, 100);
    const genres = requestUrl.searchParams.get("genres")?.trim();
    const dates = requestUrl.searchParams.get("dates")?.trim();
    const ordering = requestUrl.searchParams.get("ordering")?.trim();

    upstream.searchParams.set("page", String(page));
    upstream.searchParams.set("page_size", String(pageSize));
    if (search) upstream.searchParams.set("search", search);
    if (genres && /^[a-z0-9,-]{1,120}$/.test(genres)) upstream.searchParams.set("genres", genres);
    if (dates && /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(dates)) upstream.searchParams.set("dates", dates);
    if (ordering && ALLOWED_ORDERING.has(ordering)) upstream.searchParams.set("ordering", ordering);
  }

  try {
    const response = await fetch(upstream, { headers: { Accept: "application/json" } });
    if (!response.ok) return json({ error: "Game provider request failed" }, response.status === 429 ? 429 : 502);
    const payload = await response.json();
    return json(payload, 200, true);
  } catch {
    return json({ error: "Game provider unavailable" }, 502);
  }
}
