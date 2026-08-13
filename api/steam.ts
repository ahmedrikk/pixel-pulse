export const config = { runtime: "edge" };

const STEAM_ID = /^\d{17}$/;

function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds > 0 ? `private, max-age=${cacheSeconds}` : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function verifyOpenId(params: URLSearchParams): Promise<string | null> {
  const claimedId = params.get("openid.claimed_id") || "";
  const identity = params.get("openid.identity") || "";
  const match = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!match || identity !== claimedId) return null;

  const verification = new URLSearchParams();
  params.forEach((value, key) => {
    if (key.startsWith("openid.")) verification.set(key, value.slice(0, 2048));
  });
  verification.set("openid.mode", "check_authentication");

  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verification.toString(),
  });
  const result = await response.text();
  return response.ok && /(?:^|\n)is_valid:true(?:\n|$)/.test(result) ? match[1] : null;
}

async function playerSummary(apiKey: string, steamId: string) {
  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamId);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Steam request failed");
  const payload = await response.json();
  const player = payload.response?.players?.[0];
  if (!player) return null;
  return {
    steamId,
    personaName: String(player.personaname || "Steam User").slice(0, 100),
    profileUrl: String(player.profileurl || `https://steamcommunity.com/profiles/${steamId}`),
    avatarUrl: typeof player.avatarfull === "string" ? player.avatarfull : null,
    countryCode: typeof player.loccountrycode === "string" ? player.loccountrycode.slice(0, 2) : null,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return json({ error: "Steam is not configured" }, 503);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  try {
    if (req.method === "POST" && action === "verify-openid") {
      const contentLength = Number(req.headers.get("content-length") || 0);
      if (contentLength > 16_384) return json({ error: "Request too large" }, 413);
      const body = await req.json().catch(() => null) as { query?: string } | null;
      if (!body?.query || body.query.length > 12_000) return json({ error: "Invalid callback" }, 400);
      const steamId = await verifyOpenId(new URLSearchParams(body.query));
      if (!steamId) return json({ error: "Steam verification failed" }, 401);
      const profile = await playerSummary(apiKey, steamId);
      return profile ? json(profile) : json({ error: "Steam profile not found" }, 404);
    }

    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const steamId = url.searchParams.get("steamId") || "";
    if (!STEAM_ID.test(steamId)) return json({ error: "Invalid Steam ID" }, 400);

    if (action === "profile") {
      const profile = await playerSummary(apiKey, steamId);
      return profile ? json(profile, 200, 300) : json({ error: "Steam profile not found" }, 404);
    }
    if (action === "games") {
      const upstream = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
      upstream.searchParams.set("key", apiKey);
      upstream.searchParams.set("steamid", steamId);
      upstream.searchParams.set("include_appinfo", "true");
      upstream.searchParams.set("include_played_free_games", "true");
      const response = await fetch(upstream);
      if (!response.ok) return json({ error: "Steam request failed" }, 502);
      const payload = await response.json();
      const games = (Array.isArray(payload.response?.games) ? payload.response.games : [])
        .slice(0, 5000)
        .map((game: Record<string, unknown>) => ({
          appid: Number(game.appid),
          name: String(game.name || "").slice(0, 200),
          playtime_forever: Number(game.playtime_forever || 0),
          playtime_2weeks: Number(game.playtime_2weeks || 0),
        }));
      return json({ games }, 200, 300);
    }
    return json({ error: "Unknown action" }, 400);
  } catch {
    return json({ error: "Steam provider unavailable" }, 502);
  }
}
