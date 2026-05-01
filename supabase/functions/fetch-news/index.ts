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

  const classRe = /<div[^>]*class="[^"]*(?:article[-_]body|article[-_]content|post[-_]content|entry[-_]content|story[-_]body|content[-_]body|prose|richtext|article__body|article_body_content|post-body|entry-body|post__content|content__body|field--body|node__content|page-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
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
  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(jinaUrl, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  clearTimeout(tid);

  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.split("\n");
  let contentStart = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    if (lines[i].startsWith("Title:") || lines[i].startsWith("URL Source:") || lines[i].startsWith("Published Time:") || lines[i].startsWith("Markdown Content:")) {
      contentStart = i + 1;
    }
  }
  let content = lines.slice(contentStart).join(" ").trim();
  // Strip "Markdown Content:" if it appeared inline on the same line as content start
  content = content.replace(/^Markdown Content:\s*/, "");

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

SUMMARY STRUCTURE (4-5 sentences, 18-25 words each):
- Sentence 1: What happened (the core news fact) — aim for 20-25 words
- Sentence 2: Key details or context — aim for 20-25 words
- Sentence 3: Why it matters or additional detail — aim for 20-25 words
- Sentence 4: What comes next, reaction, or final context — aim for 20-25 words
- Optional Sentence 5: Brief wrap-up if needed

4-5 sentences x ~22 words = 100 words total. Target range: 80-120 words.

TAG RULES (named entities only, PascalCase, no # symbol, 3-6 tags max):
- Game titles: "GTA6", "EldenRing", "BaldursGate3"
- Studios/publishers: "RockstarGames", "FromSoftware", "Nintendo"
- Real people: "HideoKojima", "PhilSpencer"
- Events: "GameAwards2025", "EVO2025"
- Platform ONLY if article is about hardware: "PS5", "Switch2"

BANNED TAGS (never include): Gaming, News, Game, Games, Update, Updates, Entertainment,
RPG, FPS, Action, Adventure, Horror, Review, Preview, Trailer, Rumor, Leak,
Gameplay, Streaming, Twitch, YouTube, PCGaming, MobileGaming, Esports`;

interface SummarizeResult {
  summary: string;
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

async function summarizeWithGroq(title: string, content: string): Promise<SummarizeResult> {
  if (!GROQ_API_KEY || countWords(content) < 40) {
    return { summary: content, tags: [] };
  }

  const userPrompt = `Article Title: ${title}

Article Content:
${content.substring(0, 4000)}

Write a 4-5 sentence summary (aim for ~100 words). Return ONLY valid JSON:
{
  "summary": "your summary here",
  "tags": ["Tag1", "Tag2", "Tag3"]
}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    for (const model of MODELS) {
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
          console.warn(`  Groq ${model} ${res.status}: ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const raw = (data.choices?.[0]?.message?.content ?? "")
          .replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

        const parsed = extractJsonObject(raw);
        if (!parsed) { console.warn(`  ${model}: JSON parse failed`); continue; }

        const summary = String(parsed.summary ?? "").trim();
        if (!summary) { console.warn(`  ${model}: empty summary`); continue; }

        const wc = countWords(summary);
        const tags = (Array.isArray(parsed.tags) ? parsed.tags as unknown[] : [])
          .filter((t): t is string => typeof t === "string" && t.length > 1 && t.length < 40)
          .slice(0, 6);

        console.log(`  ok ${wc}w (${model}) tags: ${tags.join(", ")}`);
        return { summary, tags };

      } catch (err) {
        console.warn(`  Groq error (${model}):`, err);
      }
    }
  }

  console.warn(`  Groq failed — using raw content`);
  const rough = content.split(/\s+/).slice(0, 120).join(" ");
  const lastStop = Math.max(rough.lastIndexOf(". "), rough.lastIndexOf("! "), rough.lastIndexOf("? "));
  const summary = lastStop > 60 ? rough.substring(0, lastStop + 1) : rough.split(/\s+/).slice(0, 80).join(" ");
  return { summary, tags: [] };
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const items = parseRSSItems(xml, feed.source);
      allItems.push(...items);
      console.log(`${feed.source}: ${items.length} items`);
    } catch (err) {
      console.warn(`${feed.source}: failed — ${err}`);
    }
  }

  console.log(`Total from RSS: ${allItems.length} items`);
  if (allItems.length === 0) {
    return new Response(JSON.stringify({ error: "No RSS items fetched" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
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

      if (rssWords >= 50 && item.enclosureUrl) {
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

      return { ...item, content, imageUrl, scrapeMethod };
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

  const PROCESS_LIMIT = 15;
  const itemsToProcess = enrichedItems.slice(0, PROCESS_LIMIT);
  console.log(`Processing ${itemsToProcess.length}/${enrichedItems.length} articles (limit: ${PROCESS_LIMIT})`);
  for (const item of itemsToProcess) {
    try {
      const { summary, tags } = await summarizeWithGroq(item.title, item.content);

      const { error } = await supabase.from("cached_articles").upsert({
        original_id:  `${item.source}-${item.link.substring(item.link.length - 60)}`,
        title:        item.title,
        summary,
        source_url:   item.link,
        image_url:    item.imageUrl,
        og_image_url: null,
        category:     "Gaming",
        source:       item.source,
        author:       item.author,
        ai_title:     item.title,
        ai_summary:   summary,
        tags,
        likes:        0,
        article_date: (() => { try { return new Date(item.pubDate).toISOString(); } catch { return new Date().toISOString(); } })(),
        expires_at:   expiresAt.toISOString(),
      }, { onConflict: "source_url" });

      if (error) console.error(`DB upsert error for "${item.title}":`, error);
      else processed++;

      await new Promise(r => setTimeout(r, 3000));
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
