import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ESPORTS_NEWS_SOURCES = [
  { name: 'Esports Insider', rssFeed: 'https://esportsinsider.com/feed', displayName: 'Esports Insider' },
  { name: 'Sheep Esports', rssFeed: 'https://www.sheepesports.com/feed', displayName: 'Sheep Esports' },
  { name: 'Escharts', rssFeed: 'https://escharts.com/news/rss', displayName: 'Escharts' },
];

// ---------------------------------------------------------------------------
// RSS parser (no DOM — pure regex)
// ---------------------------------------------------------------------------
interface EsportsRssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  imageUrl: string | null;
  gameTag: string | null;
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

function detectGameTag(title: string): string | null {
  const tags: Record<string, string[]> = {
    valorant: ['valorant', 'vct', 'vcl'],
    cs2: ['cs2', 'counter-strike', 'csgo', 'esl', 'blast'],
    lol: ['league of legends', 'lol', 'lck', 'lec', 'lcs'],
    dota2: ['dota 2', 'dota2', 'ti', 'dreamleague'],
    overwatch2: ['overwatch', 'owl'],
    rainbow6: ['rainbow six', 'r6', 'six invitational'],
    'mobile-legends': ['mobile legends', 'mlbb', 'mpl'],
    'king-of-glory': ['king of glory', 'kog'],
  };
  const lower = title.toLowerCase();
  for (const [tag, keywords] of Object.entries(tags)) {
    if (keywords.some(kw => lower.includes(kw))) return tag;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function parseEsportsRSSItems(xml: string, maxItems = 10): EsportsRssItem[] {
  const items: EsportsRssItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];

    const title = extractCDATA(block, "title");
    const link = decodeHtmlEntities(
                    block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim()
                 || block.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim()
                 || ""
                  );
    if (!title || !link) continue;

    const pubDate = extractCDATA(block, "pubDate") || new Date().toISOString();
    const description = extractCDATA(block, "description") || extractCDATA(block, "content:encoded") || "";
    const imageUrl =
      block.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
      description.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
      description.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
      null;

    items.push({ title, link, pubDate, description, imageUrl, gameTag: detectGameTag(title) });
    if (items.length >= maxItems) break;
  }
  return items;
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

  console.log("=== fetch-esports-news pipeline starting ===");

  // Fetch all RSS feeds in parallel
  const feedResults = await Promise.allSettled(
    ESPORTS_NEWS_SOURCES.map(async (source) => {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(source.rssFeed, {
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
        return parseEsportsRSSItems(xml);
      } catch (err) {
        clearTimeout(tid);
        throw err;
      }
    })
  );

  const allItems: EsportsRssItem[] = [];
  feedResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
      console.log(`${ESPORTS_NEWS_SOURCES[i].displayName}: ${result.value.length} items`);
    } else {
      console.warn(`${ESPORTS_NEWS_SOURCES[i].displayName}: failed — ${result.reason}`);
    }
  });

  console.log(`Total from RSS: ${allItems.length} items`);
  if (allItems.length === 0) {
    return new Response(JSON.stringify({ error: "No RSS items fetched" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Upsert into cached_articles
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let inserted = 0;

  for (const item of allItems) {
    try {
      const source = ESPORTS_NEWS_SOURCES.find(
        s => item.link.includes(new URL(s.rssFeed).hostname)
      ) || ESPORTS_NEWS_SOURCES[0];

      const { error } = await supabase.from("cached_articles").upsert({
        original_id: `${source.displayName}-${item.link.slice(-40)}`,
        title: item.title,
        summary: stripHtml(item.description).slice(0, 300),
        source_url: item.link,
        image_url: item.imageUrl || '',
        category: 'esports',
        source: source.displayName,
        author: 'Staff Writer',
        ai_title: item.title,
        ai_summary: stripHtml(item.description).slice(0, 300),
        tags: item.gameTag ? [item.gameTag] : [],
        likes: 0,
        article_date: (() => { try { return new Date(item.pubDate).toISOString(); } catch { return new Date().toISOString(); } })(),
        expires_at: expiresAt,
      }, { onConflict: "source_url" });

      if (error) {
        console.error(`DB upsert error for "${item.title}":`, error);
      } else {
        inserted++;
      }
    } catch (err) {
      console.error(`Error processing "${item.title}":`, err);
    }
  }

  console.log(`=== Done: ${inserted}/${allItems.length} articles upserted ===`);

  return new Response(JSON.stringify({
    total: allItems.length,
    inserted,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
