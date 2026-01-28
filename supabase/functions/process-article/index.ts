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

    // Process articles in parallel (batch of up to 5 at a time for rate limiting)
    const batchSize = 5;
    const processedArticles: ProcessedArticle[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (article) => {
          try {
            // Generate title
            const titleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  {
                    role: "system",
                    content: "You are a gaming news headline writer. Generate engaging, click-worthy headlines that are informative but not clickbait. Always respond with ONLY the headline text, nothing else."
                  },
                  {
                    role: "user",
                    content: `Read the following article title and content, then generate a new, more engaging and click-worthy headline that is under 60 characters. Do not be clickbait, but be compelling.\n\nOriginal Title: ${article.title}\n\nContent: ${article.content.substring(0, 1500)}`
                  }
                ],
              }),
            });

            if (!titleResponse.ok) {
              const errorText = await titleResponse.text();
              console.error(`Title generation failed: ${titleResponse.status}`, errorText);
              throw new Error(`Title API error: ${titleResponse.status}`);
            }

            const titleData = await titleResponse.json();
            const processedTitle = titleData.choices?.[0]?.message?.content?.trim() || article.title;

            // Generate summary
            const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  {
                    role: "system",
                    content: "You are a gaming news summarizer. Write concise, comprehensive summaries in a clear, journalistic tone. Never use bullet points. Always respond with ONLY the summary text, nothing else."
                  },
                  {
                    role: "user",
                    content: `Read the following article and provide a concise, comprehensive summary that is exactly 100 words long. Do not use bullet points. Write in a clear, journalistic tone.\n\nTitle: ${article.title}\nSource: ${article.source}\n\nContent: ${article.content.substring(0, 3000)}`
                  }
                ],
              }),
            });

            if (!summaryResponse.ok) {
              const errorText = await summaryResponse.text();
              console.error(`Summary generation failed: ${summaryResponse.status}`, errorText);
              throw new Error(`Summary API error: ${summaryResponse.status}`);
            }

            const summaryData = await summaryResponse.json();
            const processedSummary = summaryData.choices?.[0]?.message?.content?.trim() || article.content.substring(0, 500);

            console.log(`Processed article: "${processedTitle.substring(0, 40)}..."`);

            return {
              processedTitle: processedTitle.replace(/^["']|["']$/g, ''), // Remove quotes if present
              processedSummary,
            };
          } catch (error) {
            console.error(`Error processing article "${article.title}":`, error);
            // Return original content as fallback
            return {
              processedTitle: article.title,
              processedSummary: article.content.substring(0, 500),
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
    
    if (error instanceof Error) {
      if (error.message.includes("429")) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (error.message.includes("402")) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
