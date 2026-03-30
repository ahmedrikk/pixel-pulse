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
const MODELS = ["qwen-qwq-32b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

const RSS_FEEDS = [
  { url: "https://www.ign.com/rss/articles/feed?tags=news", source: "IGN" },
  { url: "https://www.gamespot.com/feeds/news/",            source: "GameSpot" },
  { url: "https://kotaku.com/feed",                         source: "Kotaku" },
  { url: "https://www.polygon.com/rss/index.xml",           source: "Polygon" },
  { url: "https://www.dexerto.com/feed",                    source: "Dexerto" },
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

    const pubDate = extractCDATA(block, "pubDate") || new Date().toISOString();
    const author  = extractCDATA(block, "dc:creator") || extractCDATA(block, "author") || "Staff Writer";
    const description = extractCDATA(block, "description") || extractCDATA(block, "content:encoded") || "";
    const enclosureUrl = block.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] || null;

    items.push({ title, link, pubDate, author, description, enclosureUrl, source });
    if (items.length >= maxItems) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Jina AI Reader — converts any URL to clean markdown text
// ---------------------------------------------------------------------------
async function fetchWithJina(url: string): Promise<{ text: string; image: string | null }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "Accept": "application/json", "X-Timeout": "10" },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return { text: "", image: null };

    const data = await res.json();
    const text  = (data.data?.content ?? "").substring(0, 8000);
    const images: Record<string, string> = data.data?.images ?? {};
    const image = Object.keys(images)[0] ?? null;

    console.log(`  Jina: ${text.length} chars${image ? " + image" : ""} for ${url.substring(0, 60)}`);
    return { text, image };
  } catch (e) {
    console.warn(`  Jina failed for ${url.substring(0, 60)}:`, e);
    return { text: "", image: null };
  }
}

// ---------------------------------------------------------------------------
// Strip HTML
// ---------------------------------------------------------------------------
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Groq AI processing
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a gaming news editor and named-entity extractor. Given an article, produce three things:

1. TITLE: Return the original article title EXACTLY as given. Do not shorten, rephrase, or change it in any way.

2. SUMMARY (EXACTLY 100 words):
   - Count every word. Must be exactly 100 words — not 60, not 80, not 120. 100.
   - Lead with the most important fact: who, what, when, why it matters.
   - News-wire style: dense, direct, no filler phrases ("In this article…", "According to…").
   - If the content is thin, draw on your knowledge of the game/studio/franchise to fill it out.
   - One tight paragraph. No bullet points. No quotes.

3. TAGS — named entities only:
   - Game titles → "ResidentEvil2", "GTA6", "Minecraft"
   - Characters → "Mario", "MasterChief", "Kratos"
   - Studios/publishers → "Capcom", "Nintendo", "RockstarGames"
   - Real people → "HideoKojima", "Ninja"
   - Specific events → "GameAwards2025", "EVO2025"
   - Platform ONLY if article is about hardware → "PS5", "Switch2"

   BANNED: Gaming, News, VideoGames, Game, Games, Update, Updates, Entertainment,
   RPG, FPS, Action, Adventure, Puzzle, Horror, Strategy, Simulation, Sports, Racing,
   Fighting, Platformer, MOBA, Roguelike, Sandbox, OpenWorld, Multiplayer, SinglePlayer,
   CoOp, Streaming, Twitch, YouTube, PCGaming, MobileGaming, NewRelease, Gameplay,
   Review, Preview, Trailer, Rumor, Leak, Delay

   FORMAT: PascalCase, no # symbol, 4–7 tags.

Respond ONLY with valid JSON, no markdown:
{"title": "...", "summary": "...", "tags": ["Tag1", "Tag2"]}`;

async function processWithGroq(title: string, content: string, source: string): Promise<{
  processedTitle: string;
  processedSummary: string;
  processedTags: string[];
} | null> {
  if (!GROQ_API_KEY) return null;

  const userPrompt = `Article Title: ${title}
Source: ${source}

Content:
${content.substring(0, 7000)}

---
TASK:
1. Write the SUMMARY. Count every word — it MUST be exactly 100 words. Thin content is not an excuse; expand with relevant context.
2. Extract TAGS — proper nouns only. No generic words.`;

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
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) { console.warn(`Model ${model} HTTP ${res.status}`); continue; }

      const data = await res.json();
      const raw  = data.choices?.[0]?.message?.content?.trim();
      if (!raw) continue;

      // Strip Qwen QwQ reasoning blocks
      const clean = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/```json\n?|\n?```/g, "")
        .trim();

      let parsed: { title?: string; summary?: string; tags?: unknown[] };
      try { parsed = JSON.parse(clean); } catch { continue; }

      // Enforce word count — hard trim at 100, warn if < 80
      let summary = (parsed.summary ?? "").trim();
      const words = summary.split(/\s+/);
      if (words.length > 100) summary = words.slice(0, 100).join(" ") + "…";
      if (words.length < 80) console.warn(`  ⚠ Short summary (${words.length} words) for "${title.substring(0, 40)}"`);

      const tags = Array.isArray(parsed.tags)
        ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.length > 0).slice(0, 8)
        : [];

      console.log(`  ✓ ${model}: "${(parsed.title ?? title).substring(0, 50)}" | ${summary.trim().split(/\s+/).length} words | tags: ${tags.join(", ")}`);
      return { processedTitle: parsed.title || title, processedSummary: summary, processedTags: tags };

    } catch (err) {
      console.warn(`Model ${model} error:`, err);
    }
  }
  return null;
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

  // Step 3: Process new articles — Jina + Groq — in batches of 5
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  let processed = 0;

  const BATCH = 5;
  for (let i = 0; i < newItems.length; i += BATCH) {
    const batch = newItems.slice(i, i + BATCH);

    await Promise.all(batch.map(async (item) => {
      try {
        console.log(`Processing: "${item.title.substring(0, 60)}"`);

        // Fetch full article text via Jina AI Reader (with 1 retry on failure)
        let { text: jinaText, image: jinaImage } = await fetchWithJina(item.link);
        if (jinaText.length < 200) {
          console.log(`  Jina returned thin content, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
          const retry = await fetchWithJina(item.link);
          if (retry.text.length > jinaText.length) ({ text: jinaText, image: jinaImage } = retry);
        }
        const contentForAI = jinaText.length > 200 ? jinaText : stripHtml(item.description);

        // AI processing via Groq
        const ai = await processWithGroq(item.title, contentForAI, item.source);

        // Upsert into Supabase
        const { error } = await supabase.from("cached_articles").upsert({
          original_id:  `${item.source}-${item.link.substring(item.link.length - 60)}`,
          title:        item.title,
          summary:      stripHtml(item.description).substring(0, 500),
          source_url:   item.link,
          image_url:    item.enclosureUrl ?? "",
          og_image_url: jinaImage,
          category:     "Gaming",
          source:       item.source,
          author:       item.author,
          ai_title:     item.title, // always use original title, never let AI shorten it
          ai_summary:   ai?.processedSummary ?? null,
          tags:         ai?.processedTags   ?? [],
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

    // 1s pause between batches to respect Groq rate limits
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
