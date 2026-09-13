import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "vite";

const env = { ...loadEnv(process.env.NODE_ENV || "production", process.cwd(), ""), ...process.env };
const SITE_URL = (env.SITE_URL || env.VITE_SITE_URL || "https://pixel-pulse-roan.vercel.app").replace(/\/$/, "");
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
  return text.length <= length ? text : `${text.slice(0, length - 1).trim()}…`;
};

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

function renderPage({ route, title, description, heading, content, image, type = "website", schemaType = "WebPage" }) {
  const canonical = `${SITE_URL}${route === "/" ? "" : route}`;
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

  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": schemaType,
    name: heading,
    headline: heading,
    description,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Talus", url: SITE_URL },
  }).replace(/</g, "\\u003c");
  const shell = `<main id="seo-prerendered-content"><article><h1>${escapeHtml(heading)}</h1>${content}</article></main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${shell}</div>`)
    .replace("</head>", `  <script type="application/ld+json">${structured}</script>\n  </head>`);
  return html;
}

async function writeRoute(page) {
  const output = page.route === "/" ? path.join(distDir, "index.html") : path.join(distDir, page.route.slice(1), "index.html");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderPage(page), "utf8");
}

const staticPages = [
  { route: "/esports", title: "Live Esports Matches, Scores and News | Talus", description: "Follow live esports matches, schedules, scores and competitive gaming news across the biggest titles.", heading: "Live Esports Matches", content: "<p>Track current esports fixtures, tournament schedules, results and competitive gaming coverage.</p>" },
  { route: "/reviews", title: "Video Game Ratings and Reviews | Talus", description: "Browse video game ratings, player reviews and detailed game information to decide what to play next.", heading: "Video Game Ratings and Reviews", content: "<p>Explore community ratings, reviews, platforms, release information and game details.</p>" },
  { route: "/free-games", title: "Free Games to Claim This Week | Talus", description: "Find free PC and console games available to claim now, with store links and offer deadlines.", heading: "Free Games to Claim", content: "<p>See current free-game offers, participating stores and the deadlines for claiming each title.</p>" },
  { route: "/game-patch", title: "Recent Video Game Patches and Update Notes | Talus", description: "Browse recent video game patch notes, balance updates, fixes and complete update histories.", heading: "Recent Video Game Patches", content: "<p>Read recent patch notes, balance changes, bug fixes and update histories for popular games.</p>" },
  { route: "/game-calendar", title: "Upcoming Video Game Release Calendar | Talus", description: "Browse upcoming video game release dates by month and platform.", heading: "Upcoming Video Game Release Calendar", content: "<p>Explore confirmed game releases by month, date and platform.</p>" },
  { route: "/terms", title: "Terms of Service | Talus", description: "Read the terms that govern use of Talus.", heading: "Terms of Service", content: "<p>These terms explain the rules and conditions for using Talus.</p>" },
  { route: "/privacy", title: "Privacy Policy | Talus", description: "Learn how Talus collects, uses and protects personal information.", heading: "Privacy Policy", content: "<p>This policy explains how Talus handles personal information and privacy choices.</p>" },
  { route: "/cookies", title: "Cookie Policy | Talus", description: "Learn how Talus uses cookies and similar technologies.", heading: "Cookie Policy", content: "<p>This policy explains how Talus uses cookies and similar technologies.</p>" },
  { route: "/guidelines", title: "Content Guidelines | Talus", description: "Read the standards for content and community participation on Talus.", heading: "Content Guidelines", content: "<p>These guidelines describe the standards for content and participation on Talus.</p>" },
];

let articles = [];
let games = [];
try {
  [articles, games] = await Promise.all([
    rest("cached_articles", { select: "title,ai_title,summary,ai_summary,source,source_url,article_date", media_type: "neq.youtube", order: "article_date.desc", limit: "12" }),
    rest("games", { select: "id,slug,name,description,cover_image,release_date,developer,publisher,updated_at", order: "updated_at.desc", limit: "500" }),
  ]);
} catch (error) {
  console.warn(`[prerender] Database content unavailable; static routes will still be rendered: ${error.message}`);
}

const articleMarkup = articles.length
  ? `<section aria-label="Latest gaming news"><h2>Latest gaming news</h2>${articles.map((article) => `<article><h2><a href="${escapeHtml(article.source_url)}" rel="noopener noreferrer">${escapeHtml(article.ai_title || article.title)}</a></h2><p>${escapeHtml(truncate(article.ai_summary || article.summary, 240))}</p><p>${escapeHtml(article.source)}${article.article_date ? ` · <time datetime="${escapeHtml(article.article_date)}">${escapeHtml(article.article_date)}</time>` : ""}</p></article>`).join("")}</section>`
  : "<p>Discover current gaming news, esports coverage, free-game offers, patch notes and release dates.</p>";
await writeRoute({ route: "/", title: "Gaming News, Esports Scores and Game Updates | Talus", description: "Discover gaming news, esports scores, free games, patch notes, ratings and upcoming releases on Talus.", heading: "Gaming News, Esports Scores and Game Updates", content: articleMarkup });
await Promise.all(staticPages.map(writeRoute));

for (const game of games) {
  const slug = game.slug || game.id;
  if (!slug || !game.name) continue;
  const description = truncate(game.description || `Ratings, reviews, release information and updates for ${game.name}.`, 170);
  const facts = [game.developer && `Developed by ${game.developer}`, game.publisher && `Published by ${game.publisher}`, game.release_date && `Released ${game.release_date}`].filter(Boolean);
  await writeRoute({
    route: `/reviews/${encodeURIComponent(slug)}`,
    title: `${game.name} Rating and Reviews | Talus`,
    description,
    heading: `${game.name} Rating and Reviews`,
    image: game.cover_image,
    type: "article",
    schemaType: "VideoGame",
    content: `<p>${escapeHtml(truncate(game.description || description, 700))}</p>${facts.length ? `<ul>${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>` : ""}`,
  });
  await writeRoute({
    route: `/game-patch/${encodeURIComponent(game.id)}`,
    title: `${game.name} Patch Notes and Update History | Talus`,
    description: `Read the latest ${game.name} patch notes, balance changes, bug fixes and complete update history.`,
    heading: `${game.name} Patch Notes and Update History`,
    image: game.cover_image,
    content: `<p>Browse recent ${escapeHtml(game.name)} updates, balance changes, fixes and patch history.</p>`,
  });
}

console.log(`[prerender] Rendered ${staticPages.length + 1 + games.length * 2} public pages with crawlable HTML.`);