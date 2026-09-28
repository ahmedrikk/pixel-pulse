interface VercelRequestLike {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

interface GameRow {
  id: string;
  name: string;
  cover_image: string | null;
  updated_at: string | null;
}

interface PatchRow {
  id: string;
  game_id: string;
  title: string;
  summary: string;
  patch_type: string;
  version_label: string | null;
  image_url: string | null;
  published_at: string;
  updated_at: string;
  seo_slug: string;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanTemplate(html: string) {
  return html
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "")
    .replace(/<link rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<div id="root">[\s\S]*?<\/div>/i, '<div id="root"></div>');
}

function replaceMetaTag(html: string, selector: string, value: string) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`(<meta[^>]+(?:name|property)=["']${selector}["'][^>]+content=["'])[^"']*(["'][^>]*>)`, "i");
  return pattern.test(html)
    ? html.replace(pattern, `$1${escaped}$2`)
    : html.replace("</head>", `  <meta name="${selector}" content="${escaped}" />\n  </head>`);
}

function applyMetadata(html: string, game: GameRow, canonicalUrl: string) {
  const title = `${game.name} Patch Notes and Update History | Talus`;
  const description = `Read the latest ${game.name} patch notes, balance changes, bug fixes and complete update history.`;
  const image = new URL(game.cover_image || "/profile-assets/banners/city.jpg", canonicalUrl).toString();
  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  for (const [selector, value] of Object.entries({
    description,
    "og:title": title,
    "og:description": description,
    "og:type": "website",
    "og:url": canonicalUrl,
    "og:image": image,
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image,
  })) result = replaceMetaTag(result, selector, value);
  return result.replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n  </head>`);
}

function renderHub(game: GameRow, patches: PatchRow[], canonicalUrl: string) {
  const siteUrl = new URL(canonicalUrl).origin;
  const organizationId = `${siteUrl}/#organization`;
  const itemList = patches.map((patch, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `${siteUrl}/game-patch/${encodeURIComponent(game.id)}/${encodeURIComponent(patch.seo_slug)}`,
    name: patch.title,
  }));
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Talus",
        url: `${siteUrl}/`,
        logo: { "@type": "ImageObject", url: `${siteUrl}/talus-logo.png` },
      },
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        name: `${game.name} Patch Notes and Update History`,
        description: `Recent ${game.name} patches, balance changes, fixes and update history.`,
        url: canonicalUrl,
        publisher: { "@id": organizationId },
        mainEntity: { "@type": "ItemList", itemListElement: itemList },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Game Patches", item: `${siteUrl}/game-patch` },
          { "@type": "ListItem", position: 3, name: game.name, item: canonicalUrl },
        ],
      },
    ],
  }).replaceAll("<", "\\u003c");

  const entries = patches.length
    ? patches.map((patch) => `<article><p>${escapeHtml(patch.patch_type)} · <time datetime="${escapeHtml(patch.published_at)}">${escapeHtml(new Date(patch.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }))}</time></p><h2><a href="/game-patch/${encodeURIComponent(game.id)}/${encodeURIComponent(patch.seo_slug)}">${escapeHtml(patch.title)}</a></h2><p>${escapeHtml(patch.summary)}</p></article>`).join("")
    : `<p>No published patch notes are available for ${escapeHtml(game.name)} yet.</p>`;

  return `<main data-server-rendered-patch-hub style="max-width:900px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif;color:#111827;line-height:1.7"><nav aria-label="Primary navigation"><a href="/">Home</a> · <a href="/esports">Esports</a> · <a href="/free-games">Free Games</a> · <a href="/game-patch">Game Patches</a> · <a href="/game-calendar">Game Calendar</a> · <a href="/reviews">Game Ratings</a></nav><nav aria-label="Breadcrumb"><a href="/game-patch">Game Patches</a> · ${escapeHtml(game.name)}</nav><header><h1>${escapeHtml(game.name)} Patch Notes and Update History</h1><p>Browse recent ${escapeHtml(game.name)} updates, balance changes, fixes and patch history.</p></header><section aria-label="${escapeHtml(game.name)} patch archive">${entries}</section></main><script type="application/ld+json">${structuredData}</script>`;
}

async function readRows<T>(baseUrl: string, key: string, table: string, params: URLSearchParams): Promise<T[]> {
  const result = await fetch(`${baseUrl}/rest/v1/${table}?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!result.ok) throw new Error(`${table} returned ${result.status}`);
  return result.json() as Promise<T[]>;
}

export default async function handler(request: VercelRequestLike, response: VercelResponseLike) {
  const gameId = first(request.query.gameId);
  const safePathPart = /^[a-z0-9][a-z0-9-]{0,179}$/i;
  const requestedHost = first(request.headers["x-forwarded-host"]) || first(request.headers.host);
  const host = /^[a-z0-9.-]+\.vercel\.app(?::\d+)?$/i.test(requestedHost) ? requestedHost : "talus.social";
  const origin = `https://${host}`;
  const canonicalOrigin = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://talus.social").replace(/\/$/, "");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let template = "";
  try {
    const templateResponse = await fetch(`${origin}/index.html`);
    if (!templateResponse.ok) throw new Error(`Template returned ${templateResponse.status}`);
    template = cleanTemplate(await templateResponse.text());
  } catch {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(503).send("Talus is temporarily unavailable");
    return;
  }

  if (!safePathPart.test(gameId) || !supabaseUrl || !anonKey) {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(404).send(template.replace("</head>", '  <meta name="robots" content="noindex, nofollow" />\n  </head>'));
    return;
  }

  try {
    const [games, patches] = await Promise.all([
      readRows<GameRow>(supabaseUrl, anonKey, "games", new URLSearchParams({ select: "id,name,cover_image,updated_at", id: `eq.${gameId}`, limit: "1" })),
      readRows<PatchRow>(supabaseUrl, anonKey, "game_patches", new URLSearchParams({ select: "id,game_id,title,summary,patch_type,version_label,image_url,published_at,updated_at,seo_slug", game_id: `eq.${gameId}`, editorial_status: "eq.ready", order: "published_at.desc", limit: "100" })),
    ]);
    const game = games[0];
    if (!game) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.status(404).send(template.replace("</head>", '  <meta name="robots" content="noindex, nofollow" />\n  </head>'));
      return;
    }

    const canonicalUrl = `${canonicalOrigin}/game-patch/${encodeURIComponent(game.id)}`;
    const hub = renderHub(game, patches, canonicalUrl);
    const html = applyMetadata(template, game, canonicalUrl)
      .replace('<div id="root"></div>', `<div id="root">${hub}</div>`);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send(html);
  } catch (error) {
    console.error("Patch hub rendering failed", error);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(502).send(template.replace("</head>", '  <meta name="robots" content="noindex, nofollow" />\n  </head>'));
  }
}
