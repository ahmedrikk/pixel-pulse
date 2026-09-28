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
  slug: string | null;
  name: string;
  cover_image: string | null;
  description: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  release_date: string | null;
  developer: string | null;
  publisher: string | null;
  rawg_rating: number | null;
  metacritic_score: number | null;
  opencritic_score: number | null;
  our_rating: number | null;
  review_count: number | null;
  free_now: boolean | null;
  free_offer_url: string | null;
  free_offer_store: string | null;
  free_offer_ends_at: string | null;
  updated_at: string | null;
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

function plainText(value: string | null | undefined): string {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, length = 165): string {
  const text = plainText(value);
  if (text.length <= length) return text;
  const candidate = text.slice(0, length - 1).trim();
  const boundary = candidate.lastIndexOf(" ");
  return `${(boundary > Math.floor(length * 0.65) ? candidate.slice(0, boundary) : candidate).trim()}…`;
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

function renderGame(game: GameRow, canonicalUrl: string) {
  const siteUrl = new URL(canonicalUrl).origin;
  const slug = game.slug || game.id;
  const reviewCount = Math.max(0, Number(game.review_count ?? 0));
  const rating = Number(game.our_rating ?? 0);
  const description = plainText(game.description) || `Release information, ratings and patch history for ${game.name}.`;
  const publisherName = game.publisher || undefined;
  const developerName = game.developer || undefined;
  const gameId = `${canonicalUrl}#game`;
  const organizationId = `${siteUrl}/#organization`;
  const gameSchema: Record<string, unknown> = {
    "@type": "VideoGame",
    "@id": gameId,
    name: game.name,
    url: canonicalUrl,
    image: game.cover_image || undefined,
    description,
    genre: game.genres || undefined,
    gamePlatform: game.platforms || undefined,
    datePublished: game.release_date || undefined,
    applicationCategory: "Game",
    publisher: publisherName ? { "@type": "Organization", name: publisherName } : undefined,
    author: developerName ? { "@type": "Organization", name: developerName } : undefined,
  };
  if (reviewCount > 0 && rating > 0) {
    gameSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      bestRating: 5,
      worstRating: 1,
      ratingCount: reviewCount,
    };
  }
  if (game.free_now && game.free_offer_url) {
    gameSchema.offers = {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: game.free_offer_url,
      priceValidUntil: game.free_offer_ends_at || undefined,
      seller: game.free_offer_store ? { "@type": "Organization", name: game.free_offer_store } : undefined,
    };
  }
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
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: `${game.name} Game Information${reviewCount > 0 ? " and Community Ratings" : ""}`,
        url: canonicalUrl,
        description,
        publisher: { "@id": organizationId },
        about: { "@id": gameId },
      },
      gameSchema,
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Game Information", item: `${siteUrl}/reviews` },
          { "@type": "ListItem", position: 3, name: game.name, item: canonicalUrl },
        ],
      },
    ],
  }).replaceAll("<", "\\u003c");

  const facts = [
    game.release_date && `<li><strong>Release date:</strong> ${escapeHtml(game.release_date)}</li>`,
    developerName && `<li><strong>Developer:</strong> ${escapeHtml(developerName)}</li>`,
    publisherName && `<li><strong>Publisher:</strong> ${escapeHtml(publisherName)}</li>`,
    game.platforms?.length && `<li><strong>Platforms:</strong> ${escapeHtml(game.platforms.join(", "))}</li>`,
    game.genres?.length && `<li><strong>Genres:</strong> ${escapeHtml(game.genres.join(", "))}</li>`,
  ].filter(Boolean).join("");
  const ratings = [
    game.metacritic_score != null && `Metacritic ${escapeHtml(game.metacritic_score)}/100`,
    game.opencritic_score != null && `OpenCritic ${escapeHtml(game.opencritic_score)}/100`,
    game.rawg_rating != null && Number(game.rawg_rating) > 0 && `RAWG ${escapeHtml(game.rawg_rating)}/5`,
    reviewCount > 0 && rating > 0 && `Talus community ${escapeHtml(rating.toFixed(1))}/5 from ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`,
  ].filter(Boolean).join(" · ");

  return `<main data-server-rendered-game style="max-width:900px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif;color:#111827;line-height:1.7"><nav aria-label="Breadcrumb"><a href="/">Home</a> · <span>Game Information</span> · <span>${escapeHtml(game.name)}</span></nav><article><header>${game.cover_image ? `<img src="${escapeHtml(game.cover_image)}" alt="${escapeHtml(game.name)} cover art" width="1200" height="675" style="max-width:100%;height:auto;border-radius:16px" />` : ""}<h1>${escapeHtml(game.name)} Game Information${reviewCount > 0 ? " and Community Ratings" : ""}</h1>${ratings ? `<p><strong>${ratings}</strong></p>` : ""}</header><p>${escapeHtml(description)}</p>${facts ? `<h2>Game details</h2><ul>${facts}</ul>` : ""}<p><a href="/game-patch/${encodeURIComponent(game.id)}">View ${escapeHtml(game.name)} patch notes and update history</a></p>${game.free_now && game.free_offer_url ? `<p><a href="${escapeHtml(game.free_offer_url)}" rel="nofollow noopener noreferrer">Claim the current ${escapeHtml(game.free_offer_store || "store")} offer</a></p>` : ""}<p><a href="/reviews/${encodeURIComponent(slug)}">Open the interactive Talus game page</a></p></article></main><script type="application/ld+json">${structuredData}</script>`;
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
    response.status(404).send(replaceMetaTag(template, "robots", "noindex, nofollow"));
    return;
  }

  try {
    const params = new URLSearchParams({
      select: "id,slug,name,cover_image,description,genres,platforms,release_date,developer,publisher,rawg_rating,metacritic_score,opencritic_score,our_rating,review_count,free_now,free_offer_url,free_offer_store,free_offer_ends_at,updated_at",
      or: `(id.eq.${gameId},slug.eq.${gameId})`,
      limit: "1",
    });
    const gameResponse = await fetch(`${supabaseUrl}/rest/v1/games?${params}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const games = gameResponse.ok ? await gameResponse.json() as GameRow[] : [];
    const game = games[0];
    if (!game) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.status(404).send(replaceMetaTag(template, "robots", "noindex, nofollow"));
      return;
    }

    const slug = game.slug || game.id;
    const canonicalUrl = `${canonicalOrigin}/reviews/${encodeURIComponent(slug)}`;
    const reviewCount = Math.max(0, Number(game.review_count ?? 0));
    const substantial = plainText(game.description).length >= 120 || reviewCount > 0;
    const title = `${game.name} Game Information${reviewCount > 0 ? " and Community Ratings" : ""} | Talus`;
    const description = truncateAtWord(game.description || `Release information, ratings and patch history for ${game.name}.`);
    const image = new URL(game.cover_image || "/profile-assets/banners/city.jpg", canonicalUrl).toString();
    let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    for (const [selector, value] of Object.entries({
      description,
      robots: substantial ? "index, follow, max-image-preview:large" : "noindex, follow",
      "og:title": title,
      "og:description": description,
      "og:type": "website",
      "og:url": canonicalUrl,
      "og:image": image,
      "twitter:title": title,
      "twitter:description": description,
      "twitter:image": image,
    })) html = replaceMetaTag(html, selector, value);
    html = html.replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root">${renderGame(game, canonicalUrl)}</div>`);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send(html);
  } catch (error) {
    console.error("Game page rendering failed", error);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(502).send(replaceMetaTag(template, "robots", "noindex, nofollow"));
  }
}
