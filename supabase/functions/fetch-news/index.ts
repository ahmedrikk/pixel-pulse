import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

const RSS_FEEDS = [
  { url: "https://www.ign.com/rss/articles/feed?tags=news", source: "IGN" },
  { url: "https://www.gamespot.com/feeds/news/",            source: "GameSpot" },
  { url: "https://kotaku.com/feed",                         source: "Kotaku" },
  { url: "https://www.polygon.com/rss/index.xml",           source: "Polygon" },
  { url: "https://www.dexerto.com/gaming/feed/",            source: "Dexerto" },
  { url: "https://www.sportskeeda.com/feed/esports",        source: "Sportskeeda" },
  { url: "https://www.pcgamer.com/rss/",                    source: "PCGamer" },
  { url: "https://www.gematsu.com/feed",                    source: "Gematsu" },
  { url: "https://www.vg247.com/feed",                      source: "VG247" },
  { url: "https://gameinformer.com/rss.xml",                source: "Game Informer" },
  { url: "https://wccftech.com/topic/games/feed/",          source: "WCCFtech" },
  { url: "https://www.gamesradar.com/feeds/articles/rss/",  source: "GamesRadar" },
];

// ---------------------------------------------------------------------------
// RSS parser (no DOM — pure regex)
// ---------------------------------------------------------------------------
interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  description: string;
  enclosureUrl: string | null;
  source: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

function extractCDATA(block: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(cdataRe) || block.match(plainRe);
  return m ? decodeHtmlEntities(m[1].trim()) : "";
}

/**
 * Skip articles that are clearly not gaming-related (movies, TV, Oscars, etc.)
 * while keeping gaming-adjacent content (e.g. SpongeBob on Kotaku).
 */
function isGamingRelated(title: string, description: string): boolean {
  const text = (title + " " + description).toLowerCase();

  // Strong non-gaming signals — skip these
  const skipSignals = [
    /\bacademy awards?\b/,
    /\boscars?\b/,
    /\bgrammys?\b/,
    /\bemmys?\b/,
    /\bgolden globes?\b/,
    /\bred carpet\b/,
    /\bbox office\b/,
    /\bnetflix.*(shows?|series|watch|movies?)\b/,
    /\bhbo.*(shows?|series|watch|movies?)\b/,
    /\bdisney\+?.*(shows?|series|watch|movies?)\b/,
    /\bprime video\b/,
    /\bhulu\b/,
    /\bpeacock\b/,
    /\bparamount\+?\b/,
    /\bapple tv\+?\b/,
    /\bwhat to watch\b/,
    /\bbest movies?\b/,
    /\bbest shows?\b/,
    /\bbest series\b/,
    /\bmovie review\b/,
    /\bfilm review\b/,
    /\btv review\b/,
    /\bseries review\b/,
    /\bseason \d+ review\b/,
    /\bcoming to netflix\b/,
    /\bcoming to hbo\b/,
    /\bcoming to disney\b/,
    /\bstreaming (this weekend|today|now)\b/,
    /\bnarnia\b/,
    /\bharry potter\b/,
    /\bhunger games\b/,
    /\btwilight\b/,
    /\bjurassic\b/,
    /\bfast & furious\b/,
    /\bmission: impossible\b/,
    /\bjames bond\b/,
    /\b007\b/,
    /\blord of the rings\b/,
    /\bstar trek\b/,
    /\bwestworld\b/,
    /\bgame of thrones\b/,
    /\bhouse of the dragon\b/,
    /\bthe last of us\b(?!.*\bgame\b)/,
    /\brogue squirrel\b/,
  ];

  for (const re of skipSignals) {
    if (re.test(text)) return false;
  }

  return true;
}

function parseRSSItems(xml: string, source: string, maxItems = 5): RssItem[] {
  const items: RssItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];

    const title = extractCDATA(block, "title");
    const link  = decodeHtmlEntities(
                    block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim()
                 || block.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim()
                 || ""
                  );
    if (!title || !link) continue;

    const pubDate     = extractCDATA(block, "pubDate") || new Date().toISOString();
    const author      = extractCDATA(block, "dc:creator") || extractCDATA(block, "author") || "Staff Writer";
    // Prefer content:encoded if it's significantly longer than description
    const descRaw     = extractCDATA(block, "description") || "";
    const contentRaw  = extractCDATA(block, "content:encoded") || "";
    const descWords   = descRaw.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const contentWords = contentRaw.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const description = contentWords > descWords + 10 ? contentRaw : (descRaw || contentRaw);

    if (!isGamingRelated(title, description)) {
      console.log(`  [SKIP] Non-gaming: "${title.substring(0, 60)}..."`);
      continue;
    }

    const enclosureUrl =
      block.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
      description.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
      description.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
      null;

    items.push({ title, link, pubDate, author, description, enclosureUrl, source });
    if (items.length >= maxItems) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Strip HTML tags from RSS description
// ---------------------------------------------------------------------------
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/\s*The post .+ appeared first on .+\.?\s*$/i, "")
    .replace(/\s*(Read more|…\s*Source|Continue reading|Full story)[^.]*\.?\s*$/i, "")
    .replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Article scraper
// ---------------------------------------------------------------------------
function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/\s+/g, " ").trim();
}

function paragraphsFrom(html: string): string {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 80 || (p.length > 40 && /[.!?"'»]$/.test(p)))
    .join(" ");
}

function extractArticleText(html: string): string {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+class="[^"]*(?:c-related|e-recommended|related[-_]article|sidebar[-_]?|read-next|read-more|newsletter|promo|ad[-_]unit|widget|share-bar|social-bar|author-bio|bio-box)[^"]*"[^>]*>[\s\S]*?<\/(?:div|ul|li|section|aside)>/gi, " ")
    .replace(/Sign in to your [^.]+\.com account[^.]*\./gi, "")
    .replace(/<li[^>]*>\s*<a[^>]*>[^<]{5,120}<\/a>\s*<\/li>/gi, " ");

  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(stripped);
  if (articleMatch) { const t = paragraphsFrom(articleMatch[1]); if (t.length > 200) return t; }

  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(stripped);
  if (mainMatch) { const t = paragraphsFrom(mainMatch[1]); if (t.length > 200) return t; }

  const classRe = /<div[^>]*class="[^"]*(?:article[-_]body|article[-_]content|post[-_]content|entry[-_]content|story[-_]body|content[-_]body|prose|richtext|article__body|article_body_content|post-body|entry-body|post__content|content__body|field--body|node__content|page-content|js-post-body|post__content-body|article__content|article-body-component|body-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
  const classMatch = classRe.exec(stripped);
  if (classMatch) { const t = paragraphsFrom(classMatch[1]); if (t.length > 200) return t; }

  const sectionMatch = /<section[^>]*class="[^"]*(?:article|story|content)[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(stripped);
  if (sectionMatch) { const t = paragraphsFrom(sectionMatch[1]); if (t.length > 200) return t; }

  const allP = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 80 || (p.length > 40 && /[.!?"'»]$/.test(p)));
  if (allP.length >= 2) return allP.slice(0, 12).join(" ");

  return "";
}

function removeBoilerplate(text: string): string {
  return text
    .replace(/When you (purchase|buy) through links[^.]+\./gi, "")
    .replace(/Here['']s how it works\s*\.?\s*/gi, "")
    .replace(/\(?Image credit:[^)\n.]{0,80}\)?/gi, "")
    .replace(/Image:\s*[^.|\n]{0,80}?(via\s+\w+\s*)?(?=[A-Z][a-z])/g, "")
    .replace(/[\w\s/,]+via\s+(Polygon|IGN|GameSpot|Kotaku|PCGamer|Dexerto|VG247|Gematsu)\s*/gi, "")
    .replace(/\d+\s+comments?\s*/gi, "")
    .replace(/\bFollow\b\s*/g, "")
    .replace(/(Flipboard|Pinterest|Reddit|Whatsapp|Facebook|Twitter|Email)\s+(Email\s+)?(Share this article\s*\d*\s*)?(Join the conversation\s*)?(Follow us\s*)?(Add us as[^.]+\.?)?/gi, "")
    .replace(/Copy link\s*(Facebook|Twitter|X|Whatsapp|Reddit|Pinterest|Email)(\s+(Facebook|Twitter|X|Whatsapp|Reddit|Pinterest|Email))*/gi, "")
    .replace(/Add us as a preferred source on[^.]+\.?/gi, "")
    .replace(/Jump Links?\s*/gi, "")
    .replace(/Contents\s+\d+/gi, "")
    .replace(/\b[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4},?\s+\d{1,2}:\d{2}\b/g, "")
    .replace(/Unlock instant access to[^.]+\./gi, "")
    .replace(/By submitting your information you agree to[^.]+\./gi, "")
    .replace(/Sign up to[^.]+newsletter[^.]+\.?/gi, "")
    .replace(/Save for later\s*/gi, "")
    .replace(/Get Notifications for[^.]+\.?/gi, "")
    .replace(/Sign in to your [^.]+\.com account[^.]*\./gi, "")
    .replace(/\bCreate an account\b[^.]*\./gi, "")
    .replace(/\bby\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*(Published|Updated|·|\|)?/g, "")
    .replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]{2,8}\s+\d{1,2}\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*[APM]{2}\s+[A-Z]{2,4}\s+\d+\s*/g, "")
    .replace(/[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]{2,8}\s+\d{1,2}\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*[APM]{2}\s+[A-Z]{2,4}\s+\d+\s*/g, "")
    .replace(/You are now subscribed[^.]*\.?/gi, "")
    .replace(/Your weekly update on everything[^.]*\.?/gi, "")
    .replace(/A weekly videogame industry newsletter[^.]*\.?/gi, "")
    .replace(/From the creators of Edge[^.]*\.?/gi, "")
    .replace(/Jump to:\s*[^.]{0,200}(?=\s[A-Z])/g, "")
    .replace(/\b(Read more|Related|See also)\s*:/gi, "")
    .replace(/♬\s+[^♬]+♬/g, "")
    .replace(/It['']s-a me,\s*Chocolate\s*Mario!\s*🍄[^\n]*/gi, "")
    .replace(/#\w+\s+#\w+\s+#\w+/g, "")
    .replace(/\s+/g, " ").trim();
}

interface ScrapeResult {
  text: string;
  ogImage: string | null;
  method: string;
}

async function scrapeArticleDirect(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
      "Connection": "keep-alive",
    },
    redirect: "follow",
  });
  clearTimeout(tid);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    throw new Error(`Non-HTML content: ${ct}`);
  }
  const html = await res.text();

  const ogImage =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] ||
    null;

  const raw = extractArticleText(html);
  const clean = removeBoilerplate(raw);
  return {
    text: clean.length > 200 ? clean.substring(0, 6000) : "",
    ogImage: ogImage ?? null,
    method: "direct",
  };
}

async function scrapeArticleJina(url: string): Promise<ScrapeResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(jinaUrl, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  clearTimeout(tid);

  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const raw = await res.text();

  // Normalise line endings so the metadata regexes always match
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strip Jina metadata header block — match greedily up to "Markdown Content:"
  // then drop the header label itself, leaving only the article body.
  let content = text
    .replace(/^﻿/, "")                            // strip BOM if present
    .replace(/^[\s\S]*?Markdown Content:\s*/i, "")     // drop everything before article body
    // markdown → plain text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")              // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")           // [text](url) → text
    .replace(/^#{1,6}\s+/gm, "")                       // ## headers
    .replace(/\*\*([^*]+)\*\*/g, "$1")                 // **bold**
    .replace(/\*([^*]+)\*/g, "$1")                     // *italic*
    .replace(/`[^`]+`/g, "")                           // `code`
    .replace(/^[-*+]\s+/gm, "")                        // bullet points
    .replace(/^\d+\.\s+/gm, "")                        // numbered lists
    .replace(/^>\s+/gm, "")                            // blockquotes
    .replace(/\|[^\n]+\|/g, "")                        // tables
    .replace(/^---+$/gm, "")                           // horizontal rules
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Safety net: if metadata stripping didn't work and raw markers survived, bail out
  if (/^(Title:|URL Source:|Published Time:)/i.test(content)) {
    console.warn("  [jina] metadata stripping failed — skipping");
    return { text: "", ogImage: null, method: "jina" };
  }

  return {
    text: content.length > 200 ? content.substring(0, 6000) : "",
    ogImage: null,
    method: "jina",
  };
}

async function scrapeArticle(url: string): Promise<ScrapeResult> {
  try {
    const result = await scrapeArticleDirect(url);
    if (result.text.length > 200) return result;
    console.log(`  direct scrape short (${result.text.length} chars), trying Jina...`);
  } catch (err) {
    console.log(`  direct scrape failed: ${err}, trying Jina...`);
  }

  try {
    const result = await scrapeArticleJina(url);
    if (result.text.length > 200) return result;
    console.log(`  Jina scrape short (${result.text.length} chars)`);
  } catch (err) {
    console.log(`  Jina scrape failed: ${err}`);
  }

  return { text: "", ogImage: null, method: "failed" };
}

// ---------------------------------------------------------------------------
// Groq — 100-word summary + named-entity tags
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a gaming news editor for "Pixel Pulse" — an Inshorts-style news aggregator.
Your task: Condense gaming news into tight, informative summaries.

WRITING STYLE:
- Confident and specific — like a knowledgeable friend telling you what happened
- Direct, news-wire style. No filler phrases.
- Never use: "dives into", "it's worth noting", "in conclusion", "comprehensive",
  "significantly", "moreover", "furthermore", "according to", "in a statement"
- Never start with: "In this article", "This article discusses", "This news covers"

SUMMARY STRUCTURE (exactly 4 sentences, ~20 words each):
- Sentence 1: What happened (the core news fact) — max 22 words
- Sentence 2: Key details or context — max 22 words
- Sentence 3: Why it matters — max 22 words
- Sentence 4: Reaction or what comes next — max 22 words

TOTAL: 4 sentences x ~20 words = ~80 words. HARD MAXIMUM: 90 words. Never exceed 90 words.

OUTPUT FORMAT — return ONLY valid JSON with exactly these three keys:
{
  "summary": "4-sentence summary here",
  "gameTags": ["GameTitle1", "GameTitle2"],
  "tags": ["GameTitle1", "Studio", "PersonName", "EventName"]
}

gameTags RULES (game titles ONLY — this powers the review-prompt feature):
- Include every game title explicitly mentioned in the article
- PascalCase, no spaces, no # symbol: "Overwatch2", "GTA6", "EldenRing", "BaldursGate3"
- Sequels/editions MUST include the number: "Overwatch2" not "Overwatch"
- If no specific game is mentioned, use []
- Max 3 game titles

tags RULES (all named entities, PascalCase, 3-6 total, gameTags entries go here too):
- Game titles (same as gameTags): "Overwatch2", "GTA6"
- Studios/publishers: "RockstarGames", "FromSoftware", "Blizzard"
- Real people: "HideoKojima", "PhilSpencer", "AaronKeller"
- Events: "GameAwards2025", "EVO2025"
- Platform ONLY if article is about hardware: "PS5", "Switch2"

BANNED TAGS (never include in either array): Gaming, News, Game, Games, Update, Updates,
Entertainment, RPG, FPS, Action, Adventure, Horror, Review, Preview, Trailer, Rumor,
Leak, Gameplay, Streaming, Twitch, YouTube, PCGaming, MobileGaming, Esports`;

interface SummarizeResult {
  summary: string;
  gameTags: string[];
  tags: string[];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
}

async function summarizeWithGroq(title: string, content: string): Promise<SummarizeResult> {
  if (!GROQ_API_KEY) return { summary: "", gameTags: [], tags: [] };
  // Not enough content to produce a real summary — skip and retry next run
  if (countWords(content) < 15) return { summary: "", gameTags: [], tags: [] };

  const userPrompt = `Article Title: ${title}

Article Content:
${content.substring(0, 4000)}

Write a 4-sentence summary. HARD RULE: maximum 90 words total. Return ONLY valid JSON with ALL THREE keys:
{
  "summary": "your summary here",
  "gameTags": ["GameTitle1", "GameTitle2"],
  "tags": ["GameTitle1", "Tag2", "Tag3"]
}`;

  let totalRetries = 0;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    for (const model of MODELS) {
      totalRetries++;
      try {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user",   content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`  [retry ${totalRetries}] Groq ${model} ${res.status}: ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content ?? "")
          .replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

        const parsed = extractJsonObject(raw);
        if (!parsed) { console.warn(`  [retry ${totalRetries}] ${model}: JSON parse failed`); continue; }

        let summary = String(parsed.summary ?? "").trim();
        if (!summary) { console.warn(`  [retry ${totalRetries}] ${model}: empty summary`); continue; }

        // Strip any leaked metadata that Groq might have parroted
        summary = summary
          .replace(/^Title:\s*/i, "")
          .replace(/\s*URL Source:\s*https?:\/\/\S+/gi, "")
          .replace(/\s*Published Time:\s*[^.]+/gi, "")
          .replace(/\s+([.,;:!?])/g, "$1")
          .replace(/\s+/g, " ")
          .trim();

        // Strip trailing ellipsis — then find last clean sentence boundary
        if (/\.{2,}\s*$|…\s*$/.test(summary)) {
          summary = summary.replace(/\.{2,}\s*$|…\s*$/g, "").trim();
          // truncate back to last sentence-ending punctuation
          const lastStop = Math.max(
            summary.lastIndexOf(". "),
            summary.lastIndexOf("! "),
            summary.lastIndexOf("? "),
          );
          if (lastStop > 80) summary = summary.substring(0, lastStop + 1).trim();
          else summary = ""; // nothing salvageable
        }

        const wc = countWords(summary);
        const sentences = countSentences(summary);
        const lastChar = summary.slice(-1);
        const endsCleanly = /[.!?"']/.test(lastChar);

        // Quality gate: 50-100 words, 3+ sentences, ends in punctuation, not a URL
        const tooShort = wc < 50;
        const tooLong = wc > 100;
        const tooFewSentences = sentences < 3;
        const malformed = summary.startsWith("http") || !endsCleanly;

        if (tooShort || tooLong || tooFewSentences || malformed) {
          const reason = tooShort ? `short ${wc}w` : tooLong ? `long ${wc}w` : tooFewSentences ? `${sentences}s only` : "malformed";
          console.warn(`  [retry ${totalRetries}] ${model}: rejected (${reason}) — retrying`);
          continue;
        }

        const tags = (Array.isArray(parsed.tags) ? parsed.tags as unknown[] : [])
          .filter((t): t is string => typeof t === "string" && t.length > 1 && t.length < 40)
          .slice(0, 6);

        const gameTags = (Array.isArray(parsed.gameTags) ? parsed.gameTags as unknown[] : [])
          .filter((t): t is string => typeof t === "string" && t.length > 1 && t.length < 40)
          .slice(0, 3);

        console.log(`  ok ${wc}w ${sentences}s after ${totalRetries} attempt(s) (${model}) gameTags: [${gameTags.join(", ")}] tags: [${tags.join(", ")}]`);
        return { summary, gameTags, tags };

      } catch (err) {
        console.warn(`  [retry ${totalRetries}] Groq error (${model}):`, err);
      }
    }
  }
  console.warn(`  Quality gate failed after ${totalRetries} attempts — skipping (will retry next run)`);
  // Never fall back to raw scraped content as a summary — that produces garbage.
  // Skip the article; it will be retried on the next pipeline run.
  return { summary: "", gameTags: [], tags: [] };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  console.log("=== fetch-news pipeline starting ===");

  // Step 0: Delete cached articles with bad summaries so they get re-fetched
  const { data: badArticles } = await supabase
    .from("cached_articles")
    .select("source_url, ai_summary")
    .gt("expires_at", new Date().toISOString())
    .eq("category", "Gaming");

  const urlsToDelete: string[] = [];
  for (const row of (badArticles ?? [])) {
    const summary = (row.ai_summary || "").trim();
    const words = summary.split(/\s+/).filter(Boolean).length;
    const sentences = summary.split(/[.!?]+/).filter((s: string) => s.trim().length > 3).length;
    const endsInEllipsis = /\.{2,}\s*$/.test(summary) || /…\s*$/.test(summary);
    const lastChar = summary.slice(-1);
    const endsCleanly = /[.!?"')]/.test(lastChar);
    if (
      words < 50 ||
      words > 110 ||
      sentences < 3 ||
      endsInEllipsis ||
      !endsCleanly ||
      summary.startsWith("http") ||
      summary.startsWith("Title:") ||
      summary.startsWith("URL Source:") ||
      summary.startsWith("Published Time:") ||
      summary.startsWith("Markdown Content:") ||
      /\[Skip to content\]/i.test(summary) ||
      (summary.match(/https?:\/\//g) || []).length >= 3
    ) {
      urlsToDelete.push(row.source_url);
    }
  }
  // Also queue articles with empty game_tags (they predate the gameTags prompt fix)
  const { data: missingGameTags } = await supabase
    .from("cached_articles")
    .select("source_url")
    .gt("expires_at", new Date().toISOString())
    .eq("category", "Gaming")
    .eq("game_tags", "{}");

  for (const row of (missingGameTags ?? [])) {
    if (!urlsToDelete.includes(row.source_url)) urlsToDelete.push(row.source_url);
  }

  if (urlsToDelete.length > 0) {
    console.log(`  Deleting ${urlsToDelete.length} articles for re-fetch (bad summary or missing game_tags)`);
    const { error: delErr } = await supabase
      .from("cached_articles")
      .delete()
      .in("source_url", urlsToDelete);
    if (delErr) console.warn(`  Delete error: ${delErr.message}`);
  }

  // Step 1: Fetch all RSS feeds sequentially
  const allItems: RssItem[] = [];
  for (const feed of RSS_FEEDS) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(feed.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PixelPulseBot/1.0)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        redirect: "follow",
      });
      clearTimeout(tid);
      if (!res.ok) { console.warn(`  RSS ${feed.source}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = parseRSSItems(xml, feed.source);
      console.log(`  ${feed.source}: ${items.length} items`);
      allItems.push(...items);
    } catch (e) {
      console.warn(`  RSS ${feed.source}: ${e}`);
    }
  }

  // Step 2: Filter out already-cached articles
  const urls = allItems.map(i => i.link);
  const { data: existing } = await supabase
    .from("cached_articles")
    .select("source_url")
    .in("source_url", urls)
    .gt("expires_at", new Date().toISOString());

  const existingUrls = new Set((existing ?? []).map(e => e.source_url));
  const newItems = allItems.filter(item => !existingUrls.has(item.link));
  console.log(`${existingUrls.size} already cached, ${newItems.length} new articles to process`);
  // Step 3: Scrape all new articles in parallel
  interface EnrichedItem extends RssItem {
    content: string;
    imageUrl: string;
    ogImage: string | null;
    scrapeMethod: string;
  }

  const enrichedItems: EnrichedItem[] = [];

  const scrapeResults = await Promise.allSettled(
    newItems.map(async (item) => {
      const rssDesc = removeBoilerplate(stripHtml(item.description));
      const rssWords = rssDesc.split(/\s+/).filter(Boolean).length;

      let content: string;
      let scrapedImage: string | null = null;
      let scrapeMethod = "rss";

      if (rssWords >= 120) {
        content = rssDesc;
      } else {
        const scraped = await scrapeArticle(item.link);
        scrapedImage = scraped.ogImage;
        scrapeMethod = scraped.method;
        content = scraped.text.length > 100
          ? scraped.text
          : (rssWords > 5 ? rssDesc : item.title);
      }

      const imageUrl = item.enclosureUrl ?? scrapedImage ?? "";
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      console.log(`  [${item.source}] "${item.title.substring(0, 50)}..." — ${scrapeMethod} -> ${wordCount}w`);

      return { ...item, content, imageUrl, ogImage: scrapedImage, scrapeMethod };
    })
  );

  for (const result of scrapeResults) {
    if (result.status === "fulfilled") {
      enrichedItems.push(result.value);
    } else {
      console.error(`Scrape failed for an article:`, result.reason);
    }
  }

  console.log(`Scraped ${enrichedItems.length}/${newItems.length} articles successfully`);

  // Step 4: Groq summarization sequentially (rate limit respect)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  let processed = 0;

  // 20 articles × 2s delay = 40s for delays + ~20-30s API time ≈ 60-70s total
  // This fits within Supabase's 150s edge function wall-time limit.
  const PROCESS_LIMIT = 20;
  const itemsToProcess = enrichedItems.slice(0, PROCESS_LIMIT);
  console.log(`Processing ${itemsToProcess.length}/${enrichedItems.length} articles (limit: ${PROCESS_LIMIT})`);
  for (const item of itemsToProcess) {
    try {
      const { summary, gameTags, tags } = await summarizeWithGroq(item.title, item.content);

      if (!summary || summary.length < 100) {
        console.warn(`  Skipping "${item.title}" — summary failed quality gate, will retry next run`);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const { error } = await supabase.from("cached_articles").upsert({
        original_id:  `${item.source}-${item.link.substring(item.link.length - 60)}`,
        title:        item.title,
        summary,
        source_url:   item.link,
        image_url:    item.imageUrl,
        og_image_url: item.ogImage,
        category:     "Gaming",
        source:       item.source,
        author:       item.author,
        ai_title:     item.title,
        ai_summary:   summary,
        game_tags:    gameTags,
        tags,
        likes:        0,
        article_date: (() => { try { return new Date(item.pubDate).toISOString(); } catch { return new Date().toISOString(); } })(),
        expires_at:   expiresAt.toISOString(),
      }, { onConflict: "source_url" });

      if (error) console.error(`DB upsert error for "${item.title}":`, error);
      else processed++;

      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Error processing "${item.title}":`, err);
    }
  }

  console.log(`=== Done: ${processed}/${itemsToProcess.length} new articles processed ===`);

  return new Response(JSON.stringify({
    total:     allItems.length,
    cached:    existingUrls.size,
    new:       newItems.length,
    scraped:   enrichedItems.length,
    processed,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
