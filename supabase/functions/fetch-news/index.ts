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
  { url: "https://www.eurogamer.net/feed/news",             source: "Eurogamer" },
  { url: "https://www.pcgamer.com/rss/",                    source: "PCGamer" },
  { url: "https://www.rockpapershotgun.com/feed",           source: "RPS" },
  { url: "https://www.gematsu.com/feed",                    source: "Gematsu" },
  { url: "https://www.vg247.com/feed",                      source: "VG247" },
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

/** Extract text from all <p> tags inside a block of HTML */
function paragraphsFrom(html: string): string {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 40)
    .join(" ");
}

/** Pull article body text from raw HTML using semantic tags then class names */
function extractArticleText(html: string): string {
  // Remove scripts/styles first
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");

  // 1. <article> tag
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(stripped);
  if (articleMatch) { const t = paragraphsFrom(articleMatch[1]); if (t.length > 200) return t; }

  // 2. <main> tag
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(stripped);
  if (mainMatch) { const t = paragraphsFrom(mainMatch[1]); if (t.length > 200) return t; }

  // 3. Common article body class names (IGN, Kotaku, GameSpot, Polygon, etc.)
  const classMatch = /<div[^>]*class="[^"]*(?:article[-_]body|article[-_]content|post[-_]content|entry[-_]content|story[-_]body|content[-_]body|prose|richtext)[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(stripped);
  if (classMatch) { const t = paragraphsFrom(classMatch[1]); if (t.length > 200) return t; }

  // 4. All <p> tags site-wide
  const allP = [...stripped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 40);
  if (allP.length > 2) return allP.join(" ");

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
    .replace(/[\w\s\/,]+via\s+(Polygon|IGN|GameSpot|Kotaku|RPS|Eurogamer|PCGamer|Dexerto|VG247|Gematsu)\s*/gi, "")
    // Eurogamer/RPS comment counts and follow buttons
    .replace(/\d+\s+comments?\s*/gi, "")
    .replace(/News on\s+[A-Z][a-z]+\s+\d+,?\s+\d{4}\s*/gi, "")
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
    // Bylines: "by First Last" at sentence boundaries
    .replace(/\bby\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*(Published|Updated|·|\|)?/g, "")
    // "Read more:", "Related:", "See also:"
    .replace(/\b(Read more|Related|See also)\s*:/gi, "")
    .replace(/\s+/g, " ").trim();
}

async function scrapeArticle(url: string): Promise<string> {
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
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return "";
    const html = await res.text();
    const raw = extractArticleText(html);
    const clean = removeBoilerplate(raw);
    return clean.length > 200 ? clean.substring(0, 6000) : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Groq — tags only
// ---------------------------------------------------------------------------
const TAGS_PROMPT = `You extract named entities from gaming news articles.

Return ONLY a JSON array of tags — named entities only:
- Game titles: "ResidentEvil4", "GTA6", "CrimsonDesert" (PascalCase)
- Studios/publishers: "Capcom", "FromSoftware", "RockstarGames"
- Real people: "HideoKojima", "JackBlack", "ElonMusk"
- Specific events: "EVO2025", "GameAwards2025"
- Platform ONLY if article is about hardware: "PS5", "Switch2"

BANNED (do not include): Gaming, News, Game, Games, Update, Updates, Entertainment,
RPG, FPS, Action, Adventure, Horror, Review, Preview, Trailer, Rumor, Leak,
Gameplay, Streaming, Twitch, YouTube, PCGaming, MobileGaming, Esports

Rules: PascalCase, no # symbol, 3–6 tags max.
Respond ONLY with a JSON array: ["Tag1", "Tag2", "Tag3"]`;

async function extractTagsWithGroq(title: string, description: string): Promise<string[]> {
  if (!GROQ_API_KEY) return [];

  const userPrompt = `Title: ${title}\n\nDescription: ${description.substring(0, 500)}`;

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
            { role: "system", content: TAGS_PROMPT },
            { role: "user",   content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 100,
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const raw = (data.choices?.[0]?.message?.content ?? "")
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/```json\n?|\n?```/g, "")
        .trim();

      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) continue;
      const tags = JSON.parse(match[0]);
      if (!Array.isArray(tags)) continue;

      const clean = tags
        .filter((t): t is string => typeof t === "string" && t.length > 1 && t.length < 40)
        .slice(0, 6);

      console.log(`  tags (${model}): ${clean.join(", ")}`);
      return clean;

    } catch (err) {
      console.warn(`Tag extraction error (${model}):`, err);
    }
  }
  return [];
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

  // Step 3: Process new articles in batches of 10
  // Summary = RSS description (publisher-written, clean plain text, capped at 80 words)
  // Image   = RSS enclosure URL (already in the feed, no external fetch needed)
  // Tags    = Groq named-entity extraction
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  let processed = 0;

  const BATCH = 10;
  for (let i = 0; i < newItems.length; i += BATCH) {
    const batch = newItems.slice(i, i + BATCH);

    await Promise.all(batch.map(async (item) => {
      try {
        console.log(`Processing: "${item.title.substring(0, 60)}"`);

        // RSS description → clean plain text
        const rssDesc = firstWords(stripHtml(item.description), 100);
        const rssWords = rssDesc.split(/\s+/).filter(Boolean).length;

        // Scrape full article when RSS description is too short (< 50 words)
        let summary: string;
        if (rssWords >= 50) {
          summary = rssDesc;
        } else {
          const scraped = await scrapeArticle(item.link);
          if (scraped.length > 100) {
            summary = firstWords(scraped, 100);
            console.log(`  scraped → ${summary.split(/\s+/).length}w (${item.source})`);
          } else {
            summary = rssWords > 5 ? rssDesc : item.title;
          }
        }

        const tags = await extractTagsWithGroq(item.title, summary);

        console.log(`  ${summary.split(/\s+/).length}w | tags: ${tags.join(", ")}`);

        const { error } = await supabase.from("cached_articles").upsert({
          original_id:  `${item.source}-${item.link.substring(item.link.length - 60)}`,
          title:        item.title,
          summary,
          source_url:   item.link,
          image_url:    item.enclosureUrl ?? "",
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

      } catch (err) {
        console.error(`Error processing "${item.title}":`, err);
      }
    }));

    if (i + BATCH < newItems.length) {
      await new Promise(r => setTimeout(r, 1000));
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
