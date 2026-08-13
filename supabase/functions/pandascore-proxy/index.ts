import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PANDA_BASE = "https://api.pandascore.co";
const ALLOWED_PATHS = new Set(["/matches/running", "/matches/upcoming", "/matches/past"]);
const DEFAULT_ORIGINS = ["https://pixel-pulse-roan.vercel.app", "http://localhost:5173", "http://localhost:8080"];

function corsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get("ALLOWED_WEB_ORIGINS") || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  const allowed = new Set([...DEFAULT_ORIGINS, ...configured]);
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowed.has(origin) ? origin : DEFAULT_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    if (rawBody.length > 4096) return json(req, { error: "Request too large" }, 413);
    const body = JSON.parse(rawBody) as { path?: unknown; params?: unknown };
    if (typeof body.path !== "string" || !ALLOWED_PATHS.has(body.path)) return json(req, { error: "Unsupported endpoint" }, 400);

    const inputParams = body.params && typeof body.params === "object" ? body.params as Record<string, unknown> : {};
    const url = new URL(`${PANDA_BASE}${body.path}`);
    const sort = inputParams.sort;
    if (sort === "begin_at" || sort === "-begin_at") url.searchParams.set("sort", sort);
    const requestedSize = Number.parseInt(String(inputParams["page[size]"] || "50"), 10);
    url.searchParams.set("page[size]", String(Math.max(1, Math.min(100, requestedSize || 50))));

    const key = Deno.env.get("PANDASCORE_API_KEY");
    if (!key) return json(req, { error: "Esports provider is not configured" }, 503);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
    if (!response.ok) return json(req, { error: "Esports provider request failed" }, response.status === 429 ? 429 : 502);
    const payload = await response.json();
    const matches = (Array.isArray(payload) ? payload : []).slice(0, 100).map((match: Record<string, unknown>) => ({
      id: match.id,
      name: match.name,
      number_of_games: match.number_of_games,
      status: match.status,
      begin_at: match.begin_at,
      videogame: match.videogame,
      tournament: match.tournament,
      league: match.league,
      opponents: match.opponents,
      results: match.results,
      streams_list: match.streams_list,
    }));
    return json(req, matches);
  } catch {
    return json(req, { error: "Invalid request" }, 400);
  }
});
