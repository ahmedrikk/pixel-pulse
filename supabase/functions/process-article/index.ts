import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateGeminiJson, talusSystemPrompt } from "../_shared/talus-ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Groq is the continuity fallback when Gemini is unavailable.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

// Fallback order: Qwen QwQ 32B (reasoning, precise) → Llama 70B → Llama 8B
const MODELS = [
  "qwen-qwq-32b",             // Primary: reasoning model, best at following exact instructions
  "llama-3.3-70b-versatile",  // Fallback: reliable generalist
  "llama-3.1-8b-instant",     // Last resort: ultra-fast
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
 * Process a single article with Gemini, falling back to Groq.
 * Fetches full article content first (Readability); falls back to RSS snippet.
 * Extracts OG image alongside.
 * Tries multiple models if one fails.
 */
async function processArticleWithProviders(article: ArticleInput): Promise<ProcessedArticle | null> {
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

  const systemPrompt = talusSystemPrompt(`Given an article, produce three things:

1. TITLE (6-14 words): Rewrite the supplied source headline as a sharp, factual Talus headline.
   - Preserve the central fact, named entities, and level of certainty.
   - Never copy the source headline verbatim. Change its wording or structure meaningfully.
   - Make it catchy through specific stakes, not hype, withheld facts, or invented reactions.
   - Sound natural when read aloud, with varied rhythm and normal headline capitalization.
   - Never use an exclamation point, rhetorical question, em dash, all caps, or formulaic phrases
     such as "everything you need to know", "here's why", "changes everything",
     "fans are buzzing", "game-changing", or "a new era".

2. SUMMARY (EXACTLY 100 words):
   - Count every word. Must be exactly 100 words — not 60, not 80, not 120. 100.
   - Lead with the most important fact: who, what, when, why it matters.
   - News-wire style: dense, direct, no filler phrases ("In this article…", "According to…").
   - Use only facts present in the supplied article. Never invent missing context.
   - One tight paragraph. No bullet points. No quotes.

3. TAGS — exactly two named topics:
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

   Return exactly two tags, ordered by importance. Both must be explicitly
   supported by the supplied article; never invent or broaden a topic.
   FORMAT: PascalCase, no # symbol.

Respond ONLY with valid JSON, no markdown:
{"title": "...", "summary": "...", "tags": ["Tag1", "Tag2"]}`);

  const userPrompt = `Article Title: ${article.title}
Source: ${article.source}

${contentNote}
${contentForAI.substring(0, 7000)}

---
TASK:
1. Rewrite the source TITLE as a fresh 6-14 word Talus headline.
2. Write the SUMMARY. Count every word — it MUST be exactly 100 words and use only the supplied facts.
3. Extract exactly TWO TAGS — specific proper-noun topics only. No generic words.`;

  const parseProviderResult = (
    aiContent: string,
    provider: string,
  ): ProcessedArticle | null => {
    let parsedResult;
    try {
      const withoutThinking = aiContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const cleanJson = withoutThinking.replace(/```json\n?|\n?```/g, "").trim();
      parsedResult = JSON.parse(cleanJson);
    } catch {
      console.warn(`${provider} returned invalid JSON:`, aiContent.substring(0, 200));
      return null;
    }

    const processedTitle = typeof parsedResult.title === "string"
      ? parsedResult.title.replace(/\s+/g, " ").trim().replace(/^['"]|['"]$/g, "")
      : "";
    const normalizeTitle = (value: string) => value
      .toLowerCase()
      .replace(/&[a-z]+;|&#\d+;/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const titleWords = processedTitle.split(/\s+/).filter(Boolean).length;
    const formulaicTitle = /everything you need to know|what (?:players|you) need to know|here(?:'|’)s why|changes everything|fans are buzzing|game[- ]changing|a new era/i;
    if (
      !processedTitle
      || titleWords < 5
      || titleWords > 16
      || normalizeTitle(processedTitle) === normalizeTitle(article.title)
      || /[!?]|—|…/.test(processedTitle)
      || formulaicTitle.test(processedTitle)
    ) {
      console.warn(`${provider} did not return a valid rewritten headline`);
      return null;
    }

    let summary: string = parsedResult.summary || article.content;
    const words = summary.trim().split(/\s+/);
    if (words.length > 110) {
      summary = words.slice(0, 100).join(" ") + "…";
    }
    const wordCount = summary.trim().split(/\s+/).length;
    if (wordCount < 80) {
      console.warn(`${provider} returned a short summary (${wordCount} words)`);
      return null;
    }

    const tags: string[] = Array.isArray(parsedResult.tags)
      ? parsedResult.tags
        .filter((tag: unknown) => typeof tag === "string" && tag.length > 1 && tag.length < 40)
        .map((tag: string) => tag.replace(/^#+/, "").replace(/[^a-zA-Z0-9]/g, ""))
        .filter((tag: string, index: number, all: string[]) =>
          tag.length > 1 && all.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) === index
        )
        .slice(0, 2)
      : [];

    if (tags.length !== 2) {
      console.warn(`${provider} returned ${tags.length} valid topic tags; expected exactly 2`);
      return null;
    }

    console.log(`✓ Processed with ${provider}: "${parsedResult.title}"`);
    return {
      processedTitle,
      processedSummary: summary,
      processedTags: tags,
      ogImage,
    };
  };

  try {
    console.log(`Trying Gemini for article: ${article.title.substring(0, 50)}...`);
    const geminiContent = await generateGeminiJson(
      systemPrompt,
      userPrompt,
      { maxOutputTokens: 1200, timeoutMs: 60_000, service: "article-processing", operation: "summarize-and-tag" },
    );
    const geminiResult = parseProviderResult(geminiContent, "Gemini");
    if (geminiResult) return geminiResult;
  } catch (error) {
    console.warn("Gemini failed; trying Groq:", error);
  }

  if (!GROQ_API_KEY) {
    console.error("Groq fallback is not configured");
  }

  // Try each Groq fallback model in order.
  for (const model of MODELS) {
    if (!GROQ_API_KEY) break;
    try {
      console.log(`Trying Groq ${model} for article: ${article.title.substring(0, 50)}...`);

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

      const groqResult = parseProviderResult(aiContent, `Groq ${model}`);
      if (groqResult) return groqResult;

    } catch (error) {
      console.warn(`Error with model ${model}:`, error);
      continue;
    }
  }

  // All models failed
  console.error(`All models failed for article: ${article.title}`);
  return null;
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
            return await processArticleWithProviders(article);
          } catch (error) {
            console.error(`Error processing article "${article.title}":`, error);
            return null;
          }
        })
      );

      processedArticles.push(...batchResults.filter((result): result is ProcessedArticle => result !== null));

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
