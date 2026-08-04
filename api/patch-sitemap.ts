interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export default async function handler(_request: unknown, response: VercelResponseLike) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://pixel-pulse-roan.vercel.app").replace(/\/$/, "");
  if (!supabaseUrl || !anonKey) {
    response.status(503).send("Sitemap is temporarily unavailable");
    return;
  }
  const params = new URLSearchParams({
    select: "id,game_id,updated_at",
    editorial_status: "eq.ready",
    order: "published_at.desc",
    limit: "5000",
  });
  const result = await fetch(`${supabaseUrl}/rest/v1/game_patches?${params}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!result.ok) {
    response.status(502).send("Sitemap is temporarily unavailable");
    return;
  }
  const patches = await result.json() as Array<{ id: string; game_id: string; updated_at: string }>;
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${patches.map((patch) => `\n  <url><loc>${escapeXml(`${siteUrl}/game-patch/${encodeURIComponent(patch.game_id)}/${encodeURIComponent(patch.id)}`)}</loc><lastmod>${new Date(patch.updated_at).toISOString()}</lastmod></url>`).join("")}\n</urlset>\n`;
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.status(200).send(body);
}
