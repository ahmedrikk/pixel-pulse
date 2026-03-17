import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

// Fallback order: 70B (quality) → 8B (speed)
const MODELS = [
  "llama-3.3-70b-versatile",  // Primary: best quality, fast on Groq
  "llama-3.1-8b-instant",     // Fallback: ultra-fast
];

interface ArticleInput {
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Full-article content fetcher
// Runs server-side (no CORS), 8s timeout.
// Uses Mozilla Readability for clean article text + extracts OG image.
// Returns null on any failure so the caller can fall back to RSS snippet.
// ---------------------------------------------------------------------------
interface FetchedContent {
  text: string;
  ogImage: string | null;
}

async function fetchFullArticleContent(url: string): Promise<FetchedContent | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PixelPulseBot/1.0; +https://pixel-pulse.app)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    // Content-type check — skip JSON/binary responses early
    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml")
    ) {
      console.log(`Skipping non-HTML response (${contentType}) for ${url}`);
      return null;
    }

    const html = await response.text();

    // Extract OG image from <head> before Readability processes the doc
    const ogImage =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
      null;

    // --- Smart article text extraction (no DOM dependency) ---
    const text = extractArticleText(html);
    return text.length > 300 ? { text: text.substring(0, 8000), ogImage } : null;

  } catch {
    return null;
  }
}

/**
 * Smart article text extractor — no DOM dependency.
 * Priority: <article> → <main> → article-body class patterns → all <p> tags → full strip.
 * Mimics what Readability does for the common gaming news site layouts.
 */
function extractArticleText(html: string): string {
  // 1. Try semantic <article> tag
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  if (articleMatch) {
    const text = paragraphsFrom(articleMatch[1]);
    if (text.length > 300) return text;
  }

  // 2. Try <main> tag
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (mainMatch) {
    const text = paragraphsFrom(mainMatch[1]);
    if (text.length > 300) return text;
  }

  // 3. Try common article content class names (covers IGN, Kotaku, GameSpot, Polygon, etc.)
  const contentClassPattern =
    /<div[^>]*class="[^"]*(?:article[-_]body|article[-_]content|post[-_]content|entry[-_]content|story[-_]body|content[-_]body|prose|richtext)[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
  const contentMatch = contentClassPattern.exec(html);
  if (contentMatch) {
    const text = paragraphsFrom(contentMatch[1]);
    if (text.length > 300) return text;
  }

  // 4. Fall back: extract all <p> tags site-wide (still much better than full strip)
  const allParas = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 40);
  if (allParas.length > 2) return allParas.join(" ");

  // 5. Last resort: strip all tags
  return cleanText(
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

/** Extract text from all <p> tags inside a block of HTML */
function paragraphsFrom(html: string): string {
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => cleanText(m[1]))
    .filter(p => p.length > 40);
  return paras.join(" ");
}

/** Strip tags + decode entities + collapse whitespace */
function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

interface ProcessedArticle {
  processedTitle: string;
  processedSummary: string;
  processedTags: string[];
  ogImage: string | null;
}

/**
 * Process a single article with Groq.
 * Fetches full article content first (Readability); falls back to RSS snippet.
 * Extracts OG image alongside.
 * Tries multiple models if one fails.
 */
async function processArticleWithOpenRouter(article: ArticleInput): Promise<ProcessedArticle> {
  // --- Step 1: Fetch full article body + OG image ---
  let richContent: string | null = null;
  let ogImage: string | null = null;

  if (article.sourceUrl) {
    console.log(`Fetching full content for: ${article.sourceUrl}`);
    const fetched = await fetchFullArticleContent(article.sourceUrl);
    if (fetched) {
      richContent = fetched.text;
      ogImage = fetched.ogImage;
      console.log(`✓ Got full content (${richContent.length} chars)${ogImage ? " + OG image" : ""} for: ${article.title.substring(0, 50)}`);
    } else {
      console.log(`  Full fetch failed — using RSS snippet (${article.content.length} chars)`);
    }
  }

  const contentForAI = richContent ?? article.content;
  const contentNote = richContent
    ? `Full article text (${richContent.length} chars, Readability-extracted):`
    : `RSS snippet (${article.content.length} chars — thin; expand with your knowledge):`;

  const systemPrompt = `You are a gaming news editor and named-entity extractor. Given an article, produce three things:

1. TITLE (under 60 chars): Sharp, factual headline. No clickbait.

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
   - Real people (devs, streamers, executives) → "HideoKojima", "Ninja"
   - Specific events/tournaments → "GameAwards2025", "EVO2025"
   - Platform ONLY if the article is about hardware → "PS5", "Switch2"
   Rule: "Would someone searching this tag find THIS article?" If no, drop it.

   BANNED TAGS (never output): Gaming, News, VideoGames, Game, Games, Update, Updates,
   Entertainment, RPG, FPS, Action, Adventure, Puzzle, Horror, Strategy, Simulation,
   Sports, Racing, Fighting, Platformer, MOBA, Roguelike, Sandbox, OpenWorld,
   Multiplayer, SinglePlayer, CoOp, Streaming, Twitch, YouTube, PCGaming,
   MobileGaming, NewRelease, Gameplay, Review, Preview, Trailer, Rumor, Leak, Delay

   FORMAT: PascalCase, no # symbol, 4–7 tags.

Respond ONLY with valid JSON, no markdown:
{"title": "...", "summary": "...", "tags": ["Tag1", "Tag2"]}`;

  const userPrompt = `Article Title: ${article.title}
Source: ${article.source}

${contentNote}
${contentForAI.substring(0, 7000)}

---
TASK:
1. Write the SUMMARY. Count every word — it MUST be exactly 100 words. Thin content is not an excuse for a short summary; expand with relevant context from your knowledge.
2. Extract TAGS — proper nouns only. No generic words.`;

  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY secret is not set in Supabase");
  }

  // Try each model in order
  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model} for article: ${article.title.substring(0, 50)}...`);

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${model} failed: ${response.status}`, errorText);
        continue;
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content?.trim();

      if (!aiContent) {
        console.warn(`Model ${model} returned empty content`);
        continue;
      }

      let parsedResult;
      try {
        const cleanJson = aiContent.replace(/```json\n?|\n?```/g, '');
        parsedResult = JSON.parse(cleanJson);
      } catch {
        console.warn(`Model ${model} returned invalid JSON:`, aiContent.substring(0, 200));
        continue;
      }

      // Hard cap at 110 words (trim if AI overshoots)
      let summary: string = parsedResult.summary || article.content;
      const words = summary.trim().split(/\s+/);
      if (words.length > 110) {
        summary = words.slice(0, 100).join(" ") + "…";
      }
      const wordCount = summary.trim().split(/\s+/).length;
      if (wordCount < 80) {
        console.warn(`Short summary (${wordCount} words) for: ${article.title.substring(0, 50)}`);
      } else {
        console.log(`  Summary: ${wordCount} words`);
      }

      const tags: string[] = Array.isArray(parsedResult.tags)
        ? parsedResult.tags.filter((t: unknown) => typeof t === "string" && t.length > 0).slice(0, 8)
        : [];

      console.log(`✓ Processed with ${model}: "${parsedResult.title}" (${summary.length} chars)`);
      console.log(`  Tags: ${JSON.stringify(tags)}`);

      return {
        processedTitle: parsedResult.title || article.title,
        processedSummary: summary,
        processedTags: tags,
        ogImage,
      };

    } catch (error) {
      console.warn(`Error with model ${model}:`, error);
      continue;
    }
  }

  // All models failed
  console.error(`All models failed for article: ${article.title}`);
  return {
    processedTitle: article.title,
    processedSummary: article.content.length > 0 ? article.content : article.title,
    processedTags: [],
    ogImage,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { articles } = await req.json() as { articles: ArticleInput[] };

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No articles provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${articles.length} articles...`);

    const batchSize = 3;
    const processedArticles: ProcessedArticle[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)}`);

      const batchResults = await Promise.all(
        batch.map(async (article) => {
          try {
            return await processArticleWithOpenRouter(article);
          } catch (error) {
            console.error(`Error processing article "${article.title}":`, error);
            return {
              processedTitle: article.title,
              processedSummary: article.content.length > 0 ? article.content : article.title,
              processedTags: [],
              ogImage: null,
            };
          }
        })
      );

      processedArticles.push(...batchResults);

      if (i + batchSize < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Successfully processed ${processedArticles.length} articles`);

    return new Response(
      JSON.stringify({ processedArticles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
