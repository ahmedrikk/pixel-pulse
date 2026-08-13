interface VercelRequestLike {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

interface PatchRow {
  id: string;
  game_id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  patch_type: string;
  version_label: string | null;
  image_url: string | null;
  published_at: string;
  updated_at: string;
  editorial_generated_at: string | null;
  editorial_content: {
    opening?: string;
    sections?: Array<{ heading?: string; body?: string }>;
    callouts?: Array<{ label?: string; body?: string }>;
    takeaway?: string;
  };
  meta_title: string | null;
  meta_description: string | null;
  games: { id: string; name: string; cover_image: string | null } | Array<{ id: string; name: string; cover_image: string | null }>;
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

function replaceMeta(html: string, patch: PatchRow, game: { name: string; cover_image: string | null }, canonicalUrl: string) {
  const title = escapeHtml(patch.meta_title || patch.title);
  const description = escapeHtml(patch.meta_description || patch.summary);
  const image = escapeHtml(patch.image_url || game.cover_image || "/talus-logo.png");
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/>/i, `<meta property="og:image" content="${image}" />`)
    .replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n  </head>`);
}

function renderArticle(patch: PatchRow, game: { id: string; name: string; cover_image: string | null }, canonicalUrl: string) {
  const editorial = patch.editorial_content;
  const sections = editorial.sections ?? [];
  const callouts = editorial.callouts ?? [];
  if (!editorial.opening || !editorial.takeaway || sections.length < 2) return "";
  const date = new Date(patch.published_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const sectionHtml = sections.map((section, index) => {
    const callout = callouts[index];
    return `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p>${callout ? `<aside><strong>${escapeHtml(callout.label)}</strong><p>${escapeHtml(callout.body)}</p></aside>` : ""}</section>`;
  }).join("");
  const remainingCallouts = callouts.slice(sections.length).map((callout) => (
    `<aside><strong>${escapeHtml(callout.label)}</strong><p>${escapeHtml(callout.body)}</p></aside>`
  )).join("");
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: patch.title,
    description: patch.meta_description || patch.summary,
    datePublished: patch.published_at,
    dateModified: patch.editorial_generated_at || patch.updated_at,
    mainEntityOfPage: canonicalUrl,
    image: patch.image_url || game.cover_image || undefined,
    author: { "@type": "Organization", name: "Talus" },
    publisher: { "@type": "Organization", name: "Talus" },
    about: { "@type": "VideoGame", name: game.name },
  }).replaceAll("<", "\\u003c");

  return `<article data-server-rendered-patch style="max-width:760px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif;color:#111827;line-height:1.7"><nav><a href="/game-patch/${encodeURIComponent(game.id)}">Complete patch history</a> · <a href="/reviews/${encodeURIComponent(game.id)}">${escapeHtml(game.name)} details and reviews</a></nav><header><p>${escapeHtml(patch.patch_type)} · ${escapeHtml(date)}</p><h1>${escapeHtml(patch.title)}</h1><p><strong>${escapeHtml(patch.summary)}</strong></p></header><p>${escapeHtml(editorial.opening)}</p>${sectionHtml}${remainingCallouts}<section><h2>Why this patch matters</h2><p>${escapeHtml(editorial.takeaway)}</p></section><footer><a href="${escapeHtml(patch.source_url)}" rel="noopener noreferrer">Read the official notes</a></footer></article><script type="application/ld+json">${structuredData}</script>`;
}

export default async function handler(request: VercelRequestLike, response: VercelResponseLike) {
  const gameId = first(request.query.gameId);
  const patchId = first(request.query.patchId);
  const safePathPart = /^[a-z0-9][a-z0-9-]{0,179}$/i;
  const requestedHost = first(request.headers["x-forwarded-host"]) || first(request.headers.host);
  const host = /^[a-z0-9.-]+\.vercel\.app(?::\d+)?$/i.test(requestedHost)
    ? requestedHost
    : "pixel-pulse-roan.vercel.app";
  const origin = `https://${host}`;
  const canonicalOrigin = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://pixel-pulse-roan.vercel.app").replace(/\/$/, "");
  let template = "";
  try {
    const templateResponse = await fetch(`${origin}/index.html`);
    if (!templateResponse.ok) throw new Error(`Template returned ${templateResponse.status}`);
    template = await templateResponse.text();
  } catch {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(503).send("Talus is temporarily unavailable");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!safePathPart.test(gameId) || !safePathPart.test(patchId) || !supabaseUrl || !anonKey) {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(404).send(template);
    return;
  }

  const params = new URLSearchParams({
    select: "id,game_id,title,summary,source_url,source_name,patch_type,version_label,image_url,published_at,updated_at,editorial_generated_at,editorial_content,meta_title,meta_description,games!game_patches_game_id_fkey(id,name,cover_image)",
    id: `eq.${patchId}`,
    game_id: `eq.${gameId}`,
    editorial_status: "eq.ready",
    limit: "1",
  });
  const patchResponse = await fetch(`${supabaseUrl}/rest/v1/game_patches?${params}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const rows = patchResponse.ok ? await patchResponse.json() as PatchRow[] : [];
  const patch = rows[0];
  const game = patch ? (Array.isArray(patch.games) ? patch.games[0] : patch.games) : null;
  const canonicalUrl = `${canonicalOrigin}/game-patch/${encodeURIComponent(gameId)}/${encodeURIComponent(patchId)}`;
  const article = patch && game ? renderArticle(patch, game, canonicalUrl) : "";

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", article ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=60");
  if (!article || !patch || !game) {
    response.status(404).send(template);
    return;
  }
  const html = replaceMeta(template, patch, game, canonicalUrl)
    .replace('<div id="root"></div>', `<div id="root">${article}</div>`);
  response.status(200).send(html);
}
