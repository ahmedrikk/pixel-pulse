import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { articles } = await req.json() as { articles: ArticleInput[] };

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No articles provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${articles.length} articles with Gemini...`);

    // Process articles in parallel (batch of up to 5 at a time)
    const batchSize = 5;
    const processedArticles: ProcessedArticle[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (article) => {
          try {
            // Single API call for Title, Summary, and Tags
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.0-flash-lite-preview-02-05", // Using a fast, "small" model equivalent
                messages: [
                  {
                    role: "system",
                    content: `You are an expert gaming news editor and SEO specialist. 
                    Your task is to process gaming news articles and return a JSON object.
                    
                    Follow these strict rules:
                    1. **Summary**: Write a concise, factual summary exactly between 90-110 words. It must be "AI Engine Optimized" (AEO) - direct, answer-first, and data-rich. No bullet points.
                    2. **Title**: Generate a compelling, high-CTR headline (under 60 chars). No clickbait.
                    3. **Tags**: Generate 3-5 relevant hashtags. Always include specific game names, genres, or platforms mentioned.
                    
                    Respond ONLY with valid JSON in this format:
                    {
                      "title": "string",
                      "summary": "string",
                      "tags": ["string", "string"]
                    }`
                  },
                  {
                    role: "user",
                    content: `Article Title: ${article.title}\nSource: ${article.source}\nContent: ${article.content.substring(0, 2000)}`
                  }
                ],
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`AI API error: ${response.status}`, errorText);
              throw new Error(`AI API error: ${response.status}`);
            }

            const data = await response.json();
            const aiContent = data.choices?.[0]?.message?.content?.trim();

            // Parse JSON response
            let parsedResult;
            try {
              // Handle potential markdown code blocks in response
              const cleanJson = aiContent.replace(/```json\n?|\n?```/g, '');
              parsedResult = JSON.parse(cleanJson);
            } catch (e) {
              console.error("Failed to parse AI JSON response:", aiContent);
              // Fallback if JSON parsing fails
              parsedResult = {
                title: article.title,
                summary: article.content.substring(0, 300) + "...",
                tags: []
              };
            }

            console.log(`Processed: "${parsedResult.title}"`);

            return {
              processedTitle: parsedResult.title || article.title,
              processedSummary: parsedResult.summary || article.content.substring(0, 100),
              processedTags: Array.isArray(parsedResult.tags) ? parsedResult.tags : []
            };
          } catch (error) {
            console.error(`Error processing article "${article.title}":`, error);
            return {
              processedTitle: article.title,
              processedSummary: article.content.substring(0, 100) + "...",
              processedTags: []
            };
          }
        })
      );

      processedArticles.push(...batchResults);
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
