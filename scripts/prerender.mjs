import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "vite";

const env = { ...loadEnv(process.env.NODE_ENV || "production", process.cwd(), ""), ...process.env };
const SITE_URL = (env.SITE_URL || env.VITE_SITE_URL || "https://talus.social").replace(/\/$/, "");
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const distDir = path.resolve("dist");
const template = await readFile(path.join(distDir, "index.html"), "utf8");

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const plainText = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const truncate = (value, length = 170) => {
  const text = plainText(value);
  if (text.length <= length) return text;
  const candidate = text.slice(0, length - 1).trim();
  const boundary = candidate.lastIndexOf(" ");
  return `${(boundary > Math.floor(length * 0.65) ? candidate.slice(0, boundary) : candidate).trim()}…`;
};

const primaryNavigation = `<nav aria-label="Primary navigation"><a href="/">Home</a> · <a href="/esports">Esports</a> · <a href="/free-games">Free Games</a> · <a href="/game-patch">Game Patches</a> · <a href="/game-calendar">Game Calendar</a> · <a href="/reviews">Game Information</a> · <a href="/about">About</a> · <a href="/editorial-standards">Editorial Standards</a> · <a href="/corrections">Corrections</a></nav>`;
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

async function rest(table, params) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`${table} prerender query failed (${response.status})`);
  return response.json();
}

function replaceMeta(html, selector, value) {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`(<meta[^>]+(?:name|property)=["']${selector}["'][^>]+content=["'])[^"']*(["'][^>]*>)`, "i");
  return pattern.test(html) ? html.replace(pattern, `$1${escaped}$2`) : html.replace("</head>", `  <meta name="${selector}" content="${escaped}" />\n  </head>`);
}

function renderPage({ route, title, description, heading, content, image, type = "website", schemaType = "WebPage", robots = "index, follow, max-image-preview:large", bootstrapNews }) {
  const canonical = `${SITE_URL}${route === "/" ? "/" : route}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  for (const [key, value] of Object.entries({
    description,
    "og:title": title,
    "og:description": description,
    "og:type": type,
    "og:url": canonical,
    "og:image": image || `${SITE_URL}/profile-assets/banners/city.jpg`,
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image || `${SITE_URL}/profile-assets/banners/city.jpg`,
  })) html = replaceMeta(html, key, value);
  html = replaceMeta(html, "robots", robots);

  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const pageId = `${canonical}#webpage`;
  const graph = [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Talus",
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/talus-logo.png` },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "Talus",
        url: `${SITE_URL}/`,
        publisher: { "@id": organizationId },
      },
      {
        "@type": schemaType,
        "@id": pageId,
        name: heading,
        headline: heading,
        description,
        url: canonical,
        isPartOf: { "@id": websiteId },
        publisher: { "@id": organizationId },
      },
    ];
  if (route !== "/") {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: heading, item: canonical },
      ],
    });
  }
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  }).replace(/</g, "\\u003c");
  const shell = `<main id="seo-prerendered-content">${primaryNavigation}<article><h1>${escapeHtml(heading)}</h1>${content}</article></main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${shell}</div>`)
    .replace("</head>", `  <script type="application/ld+json">${structured}</script>\n  </head>`);
  if (bootstrapNews?.length) {
    html = html.replace("</body>", `  <script id="talus-initial-news" type="application/json">${safeJson(bootstrapNews)}</script>\n</body>`);
  }
  return html;
}

async function writeRoute(page) {
  const output = page.route === "/" ? path.join(distDir, "index.html") : path.join(distDir, page.route.slice(1), "index.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderPage(page), "utf8");
}

const staticPages = [
  { route: "/esports", title: "Live Esports Matches, Scores and News | Talus", description: "Follow live esports matches, schedules, scores and competitive gaming news across the biggest titles.", heading: "Live Esports Matches", content: "<p>Track current esports fixtures, tournament schedules, results and competitive gaming coverage.</p>", robots: "noindex, follow" },
  { route: "/reviews", title: "Video Game Information and Community Ratings | Talus", description: "Browse video game information, external ratings, release details and genuine community reviews.", heading: "Video Game Information and Community Ratings", content: "<p>Explore platforms, release information, external ratings, patch histories and reviews submitted by the Talus community.</p>", robots: "noindex, follow" },
  { route: "/free-games", title: "Free Games to Claim This Week | Talus", description: "Find free PC and console games available to claim now, with store links and offer deadlines.", heading: "Free Games to Claim", content: "<p>See current free-game offers, participating stores and the deadlines for claiming each title.</p>", robots: "noindex, follow" },
  { route: "/game-patch", title: "Recent Video Game Patches and Update Notes | Talus", description: "Browse recent video game patch notes, balance updates, fixes and complete update histories.", heading: "Recent Video Game Patches", content: "<p>Read recent patch notes, balance changes, bug fixes and update histories for popular games.</p>", robots: "noindex, follow" },
  { route: "/game-calendar", title: "Upcoming Video Game Release Calendar | Talus", description: "Browse upcoming video game release dates by month and platform.", heading: "Upcoming Video Game Release Calendar", content: "<p>Explore confirmed game releases by month, date and platform.</p>", robots: "noindex, follow" },
  { route: "/terms", title: "Terms of Service | Talus", description: "Read the terms that govern use of Talus.", heading: "Terms of Service", content: "<p>These terms explain the rules and conditions for using Talus.</p>" },
  { route: "/privacy", title: "Privacy Policy | Talus", description: "Learn how Talus collects, uses and protects personal information.", heading: "Privacy Policy", content: "<p>This policy explains how Talus handles personal information and privacy choices.</p>" },
  { route: "/cookies", title: "Cookie Policy | Talus", description: "Learn how Talus uses cookies and similar technologies.", heading: "Cookie Policy", content: "<p>This policy explains how Talus uses cookies and similar technologies.</p>" },
  { route: "/guidelines", title: "Content Guidelines | Talus", description: "Read the standards for content and community participation on Talus.", heading: "Content Guidelines", content: "<p>These guidelines describe the standards for content and participation on Talus.</p>" },
  { route: "/about", title: "About Talus | Talus", description: "Learn how Talus organizes gaming news, esports, free-game offers, patches, releases and community ratings.", heading: "About Talus", content: "<p>Talus is a gaming discovery platform that organizes concise linked news briefs, esports information, free-game offers, patch histories, release dates and community ratings.</p><h2>How Talus works</h2><p>Automated systems collect, deduplicate and organize eligible public gaming stories. Every news brief identifies and links to its original publication.</p>" },
  { route: "/editorial-standards", title: "Editorial Standards | Talus", description: "Read the sourcing, summarization, attribution and quality standards used by Talus.", heading: "Editorial Standards", content: "<p>Talus summaries must preserve the central facts, identify the publication and link to the original source.</p><h2>Automation and accuracy</h2><p>Automated tools help collect and summarize updates. Unsupported claims, invented quotations and misleading headlines are not allowed.</p>" },
  { route: "/corrections", title: "Corrections Policy | Talus", description: "Learn how to report an inaccurate Talus news brief, game record, patch entry or community item.", heading: "Corrections Policy", content: "<p>Readers can report factual errors through Send Error Report in Account Settings. Include the page URL, the disputed information and a reliable supporting source.</p>" },
];

let articles = [];
try {
  articles = await rest("cached_articles", { select: "id,original_id,title,ai_title,summary,ai_summary,source,source_url,image_url,og_image_url,category,author,tags,game_tags,likes,article_date,fetched_at,media_type,video_id", order: "article_date.desc", limit: "20" });
} catch (error) {
  console.warn(`[prerender] Database content unavailable; static routes will still be rendered: ${error.message}`);
}

const articleMarkup = articles.length
  ? `<section aria-label="Latest gaming news"><h2>Latest gaming news</h2>${articles.map((article) => `<article><h2><a href="${escapeHtml(article.source_url)}" rel="noopener noreferrer">${escapeHtml(article.ai_title || article.title)}</a></h2><p>${escapeHtml(truncate(article.ai_summary || article.summary, 520))}</p><p>${escapeHtml(article.source)}${article.article_date ? ` · <time datetime="${escapeHtml(article.article_date)}">${escapeHtml(article.article_date)}</time>` : ""}</p></article>`).join("")}</section>`
  : "<p>Discover current gaming news, esports coverage, free-game offers, patch notes and release dates.</p>";
const bootstrapNews = articles.map((article) => ({
  id: article.original_id || article.id,
  title: article.ai_title || article.title,
  summary: truncate(article.ai_summary || article.summary, 700),
  sourceUrl: article.source_url,
  imageUrl: article.og_image_url || article.image_url || "",
  category: article.category || "Gaming",
  timestamp: article.article_date,
  source: article.source,
  author: article.author || "Staff Writer",
  tags: article.tags || [],
  gameTags: article.game_tags || [],
  likes: article.likes || 0,
  fetchedAt: article.fetched_at,
  mediaType: article.media_type || "article",
  videoId: article.video_id || undefined,
}));
await writeRoute({ route: "/", title: "Gaming News, Esports Scores and Game Updates | Talus", description: "Discover gaming news, esports scores, free games, patch notes, ratings and upcoming releases on Talus.", heading: "Gaming News, Esports Scores and Game Updates", content: articleMarkup, bootstrapNews });
await Promise.all(staticPages.map(writeRoute));

// Game information and per-game patch hubs are rendered on demand by Vercel
// functions. Do not emit competing static files for those routes: Vercel serves
// physical files before rewrites, which previously left only a subset of games
// on the current renderer and caused the rest to return 404.
console.log(`[prerender] Rendered ${staticPages.length + 1} static public pages. Game detail routes render on demand.`);
