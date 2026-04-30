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
    const description = extractCDATA(block, "description") || extractCDATA(block, "content:encoded") || "";
    // Image: enclosure > media:content > first <img> in description HTML
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
// Strip HTML tags from RSS description and remove common RSS boilerplate
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
    // Remove trailing "Read more", "… Source", "The post X appeared first on Y."
    .replace(/\s*The post .+ appeared first on .+\.?\s*$/i, "")
    .replace(/\s*(Read more|…\s*Source|Continue reading|Full story)[^.]*\.?\s*$/i, "")
    .replace(/\s+/g, " ").trim();
}

// First N words of a string
function firstWords(text: string, n: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= n ? words.join(" ") : words.slice(0, n).join(" ");
}

// ---------------------------------------------------------------------------
// Article scraper — fetches full article HTML and extracts clean body text.
// Only called when RSS description is too short (< 50 words).
// ---------------------------------------------------------------------------

/** Strip tags + decode common HTML entities + collapse whitespace */
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

/** Extract text from all <p> tags inside a block of HTML.
 *  Only keeps paragraphs that look like prose (end with sentence-ending punctuation or are long). */
function paragraphsFrom(html: string): string {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    // Min 80 chars AND ends with sentence-ending char — filters out related-article headlines
    .filter(p => p.length > 80 || (p.length > 40 && /[.!?'"»]$/.test(p)))
    .join(" ");
}

/** Pull article body text from raw HTML using semantic tags then class names */
function extractArticleText(html: string): string {
  // Aggressively strip non-article blocks before parsing
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    // Polygon: related-article blocks are in <li> or <div> with class containing "related", "c-related", "e-recommended"
    .replace(/<[^>]+class="[^"]*(?:c-related|e-recommended|related[-_]article|sidebar[-_]?|read-next|read-more|newsletter|promo|ad[-_]unit|widget)[^"]*"[^>]*>[\s\S]*?<\/(?:div|ul|li|section)>/gi, " ")
    // Polygon login prompt
    .replace(/Sign in to your [^.]+\.com account[^.]*\./gi, "")
    // Strip any remaining <ul> list items that look like article links (short text, no period)
    .replace(/<li[^>]*>\s*<a[^>]*>[^<]{5,120}<\/a>\s*<\/li>/gi, " ");

  // 1. <article> tag — most reliable
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(stripped);
  if (articleMatch) { const t = paragraphsFrom(articleMatch[1]); if (t.length > 200) return t; }

  // 2. <main> tag
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(stripped);
  if (mainMatch) { const t = paragraphsFrom(mainMatch[1]); if (t.length > 200) return t; }

  // 3. Common article body class names
  const classMatch = /<div[^>]*class="[^"]*(?:article[-_]body|article[-_]content|post[-_]content|entry[-_]content|story[-_]body|content[-_]body|prose|richtext|article__body|article_body_content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(stripped);
  if (classMatch) { const t = paragraphsFrom(classMatch[1]); if (t.length > 200) return t; }

  // 4. Fallback: all qualifying <p> tags, capped at 12
  const allP = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 80 || (p.length > 40 && /[.!?'"»]$/.test(p)));
  if (allP.length >= 2) return allP.slice(0, 12).join(" ");

  return "";
}

/** Remove common gaming-site boilerplate from scraped text */
function removeBoilerplate(text: string): string {
  return text
    // Affiliate disclosures
    .replace(/When you (purchase|buy) through links[^.]+\./gi, "")
    .replace(/Here['']s how it works\s*\.?\s*/gi, "")
    // Image credits: "(Image credit: Xbox)" and "Image credit: ZA/UM"
    .replace(/\(?Image credit:[^)\n.]{0,80}\)?/gi, "")
    .replace(/Image:\s*[^.|\n]{0,80}?(via\s+\w+\s*)?(?=[A-Z][a-z])/g, "")
    // "X via Polygon/IGN/GameSpot" image attribution orphans
    .replace(/[\w\s/,]+via\s+(Polygon|IGN|GameSpot|Kotaku|PCGamer|Dexerto|VG247|Gematsu)\s*/gi, "")
    // Comment counts and follow buttons
    .replace(/\d+\s+comments?\s*/gi, "")
    .replace(/\bFollow\b\s*/g, "")
    // Social share / follow buttons (PCGamer embeds these inline)
    .replace(/(Flipboard|Pinterest|Reddit|Whatsapp|Facebook|Twitter|Email)\s+(Email\s+)?(Share this article\s*\d*\s*)?(Join the conversation\s*)?(Follow us\s*)?(Add us as[^.]+\.?)?/gi, "")
    .replace(/Copy link\s*(Facebook|Twitter|X|Whatsapp|Reddit|Pinterest|Email)(\s+(Facebook|Twitter|X|Whatsapp|Reddit|Pinterest|Email))*/gi, "")
    .replace(/Add us as a preferred source on[^.]+\.?/gi, "")
    // Jump Links / Table of contents
    .replace(/Jump Links?\s*/gi, "")
    .replace(/Contents\s+\d+/gi, "")
    // Timestamps like "Mar 31, 2026, 21:00" in middle of text
    .replace(/\b[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4},?\s+\d{1,2}:\d{2}\b/g, "")
    // Subscription / newsletter prompts (PCGamer, RPS)
    .replace(/Unlock instant access to[^.]+\./gi, "")
    .replace(/By submitting your information you agree to[^.]+\./gi, "")
    .replace(/Sign up to[^.]+newsletter[^.]+\./gi, "")
    // "Save for later", "Get Notifications for X"
    .replace(/Save for later\s*/gi, "")
    .replace(/Get Notifications for[^.]+\.?/gi, "")
    // Polygon: login prompt + article link headlines embedded in body
    .replace(/Sign in to your [^.]+\.com account[^.]*\./gi, "")
    .replace(/\bCreate an account\b[^.]*\./gi, "")
    // Bylines: "by First Last" at sentence boundaries
    .replace(/\bby\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*(Published|Updated|·|\|)?/g, "")
    // Gematsu bylines: "Sal Romano Mar 31 2026 / 8:29 PM EDT 0"
    .replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]{2,8}\s+\d{1,2}\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*[APM]{2}\s+[A-Z]{2,4}\s+\d+\s*/g, "")
    .replace(/[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]{2,8}\s+\d{1,2}\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*[APM]{2}\s+[A-Z]{2,4}\s+\d+\s*/g, "")
    // PCGamer newsletter subscription boilerplate
    .replace(/You are now subscribed[^.]*\./gi, "")
    .replace(/Your weekly update on everything[^.]+\./gi, "")
    .replace(/A weekly videogame industry newsletter[^.]+\./gi, "")
    .replace(/From the creators of Edge[^.]+\./gi, "")
    .replace(/Jump to:\s*[^.]{0,200}(?=\s[A-Z])/g, "")
    // "Read more:", "Related:", "See also:"
    .replace(/\b(Read more|Related|See also)\s*:/gi, "")
    .replace(/\s+/g, " ").trim();
}

interface ScrapeResult {
  text: string;
  ogImage: string | null;
}

async function scrapeArticle(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(tid);
    if (!res.ok) return { text: "", ogImage: null };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return { text: "", ogImage: null };
    const html = await res.text();

    // Extract og:image
    const ogImage =
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] ||
      null;

    const raw = extractArticleText(html);
    const clean = removeBoilerplate(raw);
    return {
      text: clean.length > 200 ? clean.substring(0, 6000) : "",
      ogImage: ogImage ?? null,
    };
  } catch {
    return { text: "", ogImage: null };
  }
}

// ---------------------------------------------------------------------------
// Groq — 100-word Inshorts-style summary + named-entity tags (rapid100 approach)
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

4-5 sentences × ~22 words = 100 words total. Target range: 80-120 words.

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
  // Not enough content to summarize — return as-is
  if (!GROQ_API_KEY || countWords(content) < 40) {
    return { summary: content, tags: [] };
  }

  const MAX_RETRIES = 2;

  const userPrompt = `Article Title: ${title}

Article Content:
${content.substring(0, 4000)}

Write a 4-5 sentence summary (aim for ~100 words). Return ONLY valid JSON:
{
  "summary": "your summary here",
  "tags": ["Tag1", "Tag2", "Tag3"]
}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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

        console.log(`  ✓ ${wc}w (${model}) tags: ${tags.join(", ")}`);
        return { summary, tags };

      } catch (err) {
        console.warn(`  Groq error (${model}):`, err);
      }
    }
  }

  console.warn(`  Groq failed — using raw content`);
  // Truncate at sentence boundary so we don't cut mid-word/mid-sentence
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

  // Step 1: Fetch all RSS feeds server-side in parallel
  const feedResults = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(feed.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PixelPulseBot/1.0)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        return parseRSSItems(xml, feed.source);
      } catch (err) {
        clearTimeout(tid);
        throw err;
      }
    })
  );

  const allItems: RssItem[] = [];
  feedResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
      console.log(`${RSS_FEEDS[i].source}: ${result.value.length} items`);
    } else {
      console.warn(`${RSS_FEEDS[i].source}: failed — ${result.reason}`);
    }
  });

  console.log(`Total from RSS: ${allItems.length} items`);
  if (allItems.length === 0) {
    return new Response(JSON.stringify({ error: "No RSS items fetched" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Step 2: Filter out already-cached (non-expired) articles
  const urls = allItems.map(i => i.link);
  const { data: existing } = await supabase
    .from("cached_articles")
    .select("source_url")
    .in("source_url", urls)
    .gt("expires_at", new Date().toISOString());

  const existingUrls = new Set((existing ?? []).map(e => e.source_url));
  const newItems = allItems.filter(item => !existingUrls.has(item.link));

  console.log(`${existingUrls.size} already cached, ${newItems.length} new articles to process`);

  // Step 3: Process new articles sequentially (Groq rate limit: ~20 req/min free tier)
  // Content = scraped article text OR RSS description (whichever has more signal)
  // Summary = Groq 100-word Inshorts-style summary with retry validation
  // Image   = RSS enclosure URL or scraped og:image
  // Tags    = named entities extracted by same Groq call
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  let processed = 0;

  for (const item of newItems) {
    try {
      console.log(`Processing: "${item.title.substring(0, 60)}"`);

      // Get best available content for AI summarization
      const rssDesc = removeBoilerplate(stripHtml(item.description));
      const rssWords = rssDesc.split(/\s+/).filter(Boolean).length;

      let content: string;
      let scrapedImage: string | null = null;

      if (rssWords >= 50 && item.enclosureUrl) {
        // RSS has enough text + image — skip scrape to save time
        content = rssDesc;
      } else {
        const scraped = await scrapeArticle(item.link);
        scrapedImage = scraped.ogImage;
        content = scraped.text.length > 100 ? scraped.text : (rssWords > 5 ? rssDesc : item.title);
        console.log(`  scraped → ${content.split(/\s+/).length}w`);
      }

      const imageUrl = item.enclosureUrl ?? scrapedImage ?? "";

      // AI: 100-word summary + named-entity tags in one call
      const { summary, tags } = await summarizeWithGroq(item.title, content);

      const { error } = await supabase.from("cached_articles").upsert({
        original_id:  `${item.source}-${item.link.substring(item.link.length - 60)}`,
        title:        item.title,
        summary,
        source_url:   item.link,
        image_url:    imageUrl,
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

      // 3s gap between articles — respect Groq free tier (20 req/min)
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      console.error(`Error processing "${item.title}":`, err);
    }
  }

  console.log(`=== Done: ${processed}/${newItems.length} new articles processed ===`);

  return new Response(JSON.stringify({
    total:     allItems.length,
    cached:    existingUrls.size,
    new:       newItems.length,
    processed,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
