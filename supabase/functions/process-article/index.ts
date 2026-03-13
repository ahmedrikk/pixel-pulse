import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// OpenRouter API configuration
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";

// Fallback order: Hunter Alpha → GPT-4o Mini → Claude Haiku → Llama
const MODELS = [
  "openrouter/hunter-alpha",           // Primary: fast, low cost
  "openai/gpt-4o-mini",               // Fallback 1: proven structured output
  "anthropic/claude-3-haiku",          // Fallback 2: great at following instructions
  "meta-llama/llama-3.1-8b-instruct", // Fallback 3: free/cheap
];

interface ArticleInput {
  title: string;
  content: string;
  source: string;
}

interface ProcessedArticle {
  processedTitle: string;
  processedSummary: string;
  processedTags: string[];
}

/**
 * Process a single article with OpenRouter
 * Tries multiple models if one fails
 */
async function processArticleWithOpenRouter(article: ArticleInput): Promise<ProcessedArticle> {
  const systemPrompt = `You are an expert gaming news editor, SEO specialist, and hashtag strategist.
You are an intelligent content agent. Your job is to deeply read a gaming news article and extract three things:

1. **TITLE** (under 60 chars): A sharp, factual headline. No clickbait.

2. **SUMMARY** (EXACTLY 270–280 characters): Dense, fact-first summary.
   - Count every character including spaces. It MUST be between 270 and 280 chars. Not 100. Not 200. 270–280.
   - If the source text is short (under 200 chars), you MUST expand it using your own knowledge of the topic, franchise, developer, or context. Do not just restate the headline.
   - Write like a news wire: pack in who, what, when, where, why it matters — all in one tight paragraph.
   - No bullet points. No quotes. No "In this article..." filler. Start with the subject directly.

3. **TAGS** — Act as a named entity extractor. Read the article and pull out the real-world proper nouns that define what this article is about. Think:
   - What game(s) are mentioned by name? → "ResidentEvil2", "GTA6", "Minecraft"
   - What characters appear? → "Mario", "MasterChief", "Kratos", "Pikachu"
   - What studios/publishers are named? → "Capcom", "Nintendo", "RockstarGames"
   - What real people (streamers, devs, executives)? → "HideoKojima", "Ninja", "xQc"
   - What specific events or tournaments? → "GameAwards2025", "IEM", "VCT"
   - What platform ONLY if the article is specifically about hardware? → "PS5", "Switch2"

   AGENT RULE — ask yourself: "If someone searched this tag, would they find THIS article?" If yes, include it. If not, drop it.

   ABSOLUTE BANS — never output any of these under any circumstances:
   Gaming, News, VideoGames, Game, Games, Update, Updates, Entertainment,
   RPG, FPS, Action, Adventure, Puzzle, Horror, Strategy, Simulation, Sports,
   Racing, Fighting, Platformer, MOBA, Roguelike, Sandbox, OpenWorld, Multiplayer,
   SinglePlayer, CoOp, Streaming, Twitch, YouTube, PCGaming, MobileGaming,
   NewRelease, Gameplay, Review, Preview, Trailer, Rumor, Leak, Delay

   FORMAT: PascalCase, no # symbol, 4–7 tags total.

Respond ONLY with valid JSON — no markdown, no explanation:
{"title": "...", "summary": "...", "tags": ["Tag1", "Tag2", "Tag3"]}`;

  const userPrompt = `Analyze this gaming article carefully.

Article Title: ${article.title}
Source: ${article.source}

Full Article Content:
${article.content.substring(0, 6000)}

---

Read this article fully. Then:

1. Write the SUMMARY — count the characters. Must land between 270 and 280. If the source snippet is short, use your knowledge of the game/studio/event to pad it out with relevant context. A short source is NOT an excuse for a short summary.
2. Extract TAGS as a named entity agent — only proper nouns: game titles, character names, real people, studios, events. Zero generic category words. Ask yourself for each tag: "Is this a specific named thing from this article?" If no, remove it.`;

  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY secret is not set in Supabase");
  }

  // Try each model in order
  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model} for article: ${article.title.substring(0, 50)}...`);
      
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pixel-pulse.app", // Your app URL for OpenRouter leaderboard
          "X-Title": "Pixel Pulse Gaming News",
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
