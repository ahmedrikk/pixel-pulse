import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// OpenRouter API configuration
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Using user's provided API key (in production, store this in environment variables)
const OPENROUTER_API_KEY = "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";

// Recommended models for cost/performance balance
// Fallback order: GPT-4o Mini → Claude Haiku → Llama
const MODELS = [
  "openai/gpt-4o-mini",           // Fast, cheap, great for structured outputs
  "anthropic/claude-3-haiku",      // Fast, good at following instructions
  "meta-llama/llama-3.1-8b-instruct", // Free/cheap fallback
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
Your task is to analyze gaming news articles and generate smart, searchable hashtags based on the FULL article content.

FOLLOW THESE RULES STRICTLY:

1. **TITLE** (under 60 chars): Create a compelling, high-CTR headline. No clickbait.

2. **SUMMARY** (90-110 words): Write a concise, factual, "AI Engine Optimized" summary.
   - Direct, answer-first, data-rich
   - No bullet points
   - Include key facts, numbers, dates

3. **HASHTAGS** (5-8 tags): Generate HIGHLY SPECIFIC, SEARCHABLE hashtags:
   
   PRIORITY 1 - GAME NAMES (Always include if mentioned):
   - Exact game titles: "EldenRing", "GTA6", "BaldursGate3", "Valorant", "Minecraft"
   - Include sequel numbers: "FinalFantasy16", "StreetFighter6"
   
   PRIORITY 2 - PLATFORMS & HARDWARE:
   - Consoles: "PS5", "PlayStation", "Xbox", "XboxSeriesX", "NintendoSwitch", "Switch2"
   - PC: "PCGaming", "Steam", "SteamDeck"
   - Graphics: "RTX4090", "RTX5090", "AMD", "NVIDIA"
   
   PRIORITY 3 - CONTENT TYPE:
   - News types: "GameUpdate", "NewRelease", "DLC", "Expansion", "Remake", "Remaster"
   - Events: "GameAwards", "E3", "Gamescom", "TGA"
   
   PRIORITY 4 - CHARACTERS & IP:
   - Character names: "Mario", "Link", "Kratos", "MasterChief"
   - Studios: "Nintendo", "Rockstar", "FromSoftware", "CDProjektRed"
   
   PRIORITY 5 - GENRE & TOPICS:
   - Genres: "RPG", "FPS", "BattleRoyale", "MOBA", "IndieGame", "Roguelike"
   - Trends: "Speedrun", "Esports", "Twitch", "Streaming"

HASHTAG FORMAT RULES:
- NO # symbol in the tag string
- Use PascalCase for multi-word tags: "EldenRing" not "eldenring"
- Keep abbreviations uppercase: "PS5", "DLC", "FPS"
- Be SPECIFIC: "GTA6" not just "GTA"
- Maximum 8 tags, minimum 5

Respond ONLY with valid JSON:
{
  "title": "string",
  "summary": "string",
  "tags": ["GameName", "Platform", "Genre", "ContentType", "Studio"]
}

Example good tags: ["GTA6", "RockstarGames", "PS5", "Xbox", "OpenWorld", "NewRelease"]
Example bad tags: ["Gaming", "News", "VideoGames", "Fun"] (too generic!)`;

  const userPrompt = `Analyze this gaming article and generate specific, searchable hashtags.

Article Title: ${article.title}
Source: ${article.source}

Full Article Content:
${article.content.substring(0, 6000)}

---

Generate hashtags based on:
1. Specific game names mentioned (e.g., "EldenRing", "GTA6")
2. Platforms (e.g., "PS5", "Xbox", "PCGaming")
3. Content type (e.g., "NewRelease", "DLC", "Update")
4. Studios/Characters if relevant
5. Genres (e.g., "RPG", "FPS", "IndieGame")

Remember: NO generic tags like "Gaming" or "News". Be SPECIFIC!`;

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

      console.log(`✓ Successfully processed with ${model}: "${parsedResult.title}"`);
      console.log(`  Tags: ${JSON.stringify(parsedResult.tags)}`);

      return {
        processedTitle: parsedResult.title || article.title,
        processedSummary: parsedResult.summary || article.content.substring(0, 300) + "...",
        processedTags: Array.isArray(parsedResult.tags) ? parsedResult.tags : []
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
    processedSummary: article.content.substring(0, 300) + "...",
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
              processedSummary: article.content.substring(0, 300) + "...",
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
