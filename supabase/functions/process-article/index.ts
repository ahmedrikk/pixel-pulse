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
// Runs server-side (no CORS), 8s timeout, strips HTML to plain text.
// Returns null on any failure so the caller can fall back to RSS snippet.
// ---------------------------------------------------------------------------
async function fetchFullArticleContent(url: string): Promise<string | null> {
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

    const html = await response.text();
    const text = stripHtml(html);
    // Only use if we got something meaningfully longer than a typical RSS snippet
    return text.length > 300 ? text.substring(0, 8000) : null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    // Remove <script> and <style> blocks entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    // Remove nav/header/footer/aside noise (crude but effective)
    .replace(/<(nav|header|footer|aside|menu)\b[^<]*(?:(?!<\/\1>)[\s\S])*<\/\1>/gi, " ")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

interface ProcessedArticle {
  processedTitle: string;
  processedSummary: string;
  processedTags: string[];
}

/**
 * Process a single article with Groq.
 * Tries to fetch full article content first; falls back to RSS snippet.
 * Tries multiple models if one fails.
 */
async function processArticleWithOpenRouter(article: ArticleInput): Promise<ProcessedArticle> {
  // --- Step 1: Attempt to fetch the full article body server-side ---
  let richContent: string | null = null;
  if (article.sourceUrl) {
    console.log(`Fetching full content for: ${article.sourceUrl}`);
    richContent = await fetchFullArticleContent(article.sourceUrl);
    if (richContent) {
      console.log(`✓ Got full content (${richContent.length} chars) for: ${article.title.substring(0, 50)}`);
    } else {
      console.log(`  Full fetch failed/skipped — using RSS snippet (${article.content.length} chars)`);
    }
  }

  const contentForAI = richContent ?? article.content;
  const contentNote = richContent
    ? `Full article text (${richContent.length} chars scraped from source):`
    : `RSS snippet (${article.content.length} chars — short; use your knowledge to expand):`;

  const systemPrompt = `You are a gaming news editor and named-entity extractor. Given an article, produce three things:

1. TITLE (under 60 chars): Sharp, factual headline. No clickbait.

2. SUMMARY (EXACTLY 270–280 characters):
   - Count EVERY character including spaces. Must land between 270 and 280. Not 100. Not 200. Not 269. Not 281. 270–280.
   - Lead with the most important fact: who, what, when, why it matters.
   - News-wire style: dense, direct, no filler phrases ("In this article…", "According to…").
   - If the content is thin, draw on your knowledge of the game/studio/franchise to add context.
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
1. Write the SUMMARY. Count the characters — it MUST be 270–280. Thin source content is not an excuse for a short summary; expand with relevant context from your knowledge.
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
          temperature: 0.3, // Lower temperature for more consistent structured output
          response_format: { type: "json_object" }, // Request JSON output
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${model} failed: ${response.status}`, errorText);
        continue; // Try next model
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content?.trim();

      if (!aiContent) {
        console.warn(`Model ${model} returned empty content`);
        continue;
      }

      // Parse JSON response
      let parsedResult;
      try {
        // Handle potential markdown code blocks in response
        const cleanJson = aiContent.replace(/```json\n?|\n?```/g, '');
        parsedResult = JSON.parse(cleanJson);
      } catch (e) {
        console.warn(`Model ${model} returned invalid JSON:`, aiContent.substring(0, 200));
        continue; // Try next model
      }

      // Enforce 280-char hard cap; trim at word boundary
      let summary: string = parsedResult.summary || article.content.substring(0, 280);
      if (summary.length > 280) {
        const cut = summary.substring(0, 279);
        const lastSpace = cut.lastIndexOf(" ");
        summary = (lastSpace > 200 ? cut.substring(0, lastSpace) : cut) + "…";
      }
      // Log a warning if too short (AI didn't comply) but still use it
      if (summary.length < 250) {
        console.warn(`Short summary (${summary.length} chars) for: ${article.title.substring(0, 50)}`);
      }

      const tags: string[] = Array.isArray(parsedResult.tags)
        ? parsedResult.tags.filter((t: unknown) => typeof t === "string" && t.length > 0).slice(0, 8)
        : [];

      console.log(`✓ Successfully processed with ${model}: "${parsedResult.title}" (${summary.length} chars)`);
      console.log(`  Tags: ${JSON.stringify(tags)}`);

      return {
        processedTitle: parsedResult.title || article.title,
        processedSummary: summary,
        processedTags: tags,
      };

    } catch (error) {
      console.warn(`Error with model ${model}:`, error);
      continue; // Try next model
    }
  }

  // All models failed, return fallback
  console.error(`All models failed for article: ${article.title}`);
  return {
    processedTitle: article.title,
    processedSummary: article.content.length > 0 ? article.content : article.title,
    processedTags: []
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log(`Processing ${articles.length} articles with OpenRouter...`);

    // Process articles in parallel (batch of up to 3 at a time to respect rate limits)
    const batchSize = 3;
    const processedArticles: ProcessedArticle[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)}`);

      const batchResults = await Promise.all(
        batch.map(async (article) => {
          try {
            return await processArticleWithOpenRouter(article);
          } catch (error) {
            console.error(`Error processing article "${article.title}":`, error);
            return {
              processedTitle: article.title,
              processedSummary: article.content.length > 0 ? article.content : article.title,
              processedTags: []
            };
          }
        })
      );

      processedArticles.push(...batchResults);
      
      // Small delay between batches to respect rate limits
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
