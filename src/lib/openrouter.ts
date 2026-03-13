/**
 * Groq API Client
 * Client-side fallback for article processing when Supabase edge function is unavailable
 */

import { NewsItem } from "@/data/mockNews";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// API key from environment variable (GitHub Secret)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

// Models to try in order of preference
const MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Check if OpenRouter is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!GROQ_API_KEY && GROQ_API_KEY !== "";
}

/**
 * Generate smart hashtags for a single article using OpenRouter
 */
export async function generateTagsWithOpenRouter(
  title: string,
  content: string
): Promise<string[]> {
  if (!isOpenRouterConfigured()) {
    console.warn("OpenRouter API key not configured");
    return [];
  }

  const systemPrompt = `You are a gaming news hashtag expert. Generate 5-8 specific, searchable hashtags for this gaming article.

RULES:
- Use PascalCase: "EldenRing" not "eldenring"
- NO # symbols
- Be SPECIFIC: "GTA6" not "GTA"
- Include: Game names, Platforms (PS5, Xbox, PCGaming), Content type (NewRelease, DLC)
- NO generic tags like "Gaming" or "News"

Respond ONLY with a JSON array: ["Tag1", "Tag2", "Tag3"]`;

  const userPrompt = `Title: ${title}

Content: ${content.substring(0, 3000)}

Generate hashtags:`;

  for (const model of MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) continue;

      const data: OpenRouterResponse = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) continue;

      // Try to parse as JSON array
      try {
        const cleanJson = content.replace(/```json\n?|\n?```/g, '');
        const tags = JSON.parse(cleanJson);
        if (Array.isArray(tags)) {
          return tags.map((t: string) => t.trim()).filter((t: string) => t.length > 0);
        }
      } catch {
        // If not valid JSON, try to extract tags from text
        const tagMatches = content.match(/["']([^"']+)["']/g);
        if (tagMatches) {
          return tagMatches.map(t => t.replace(/["']/g, ''));
        }
      }
    } catch (error) {
      console.warn(`OpenRouter model ${model} failed:`, error);
      continue;
    }
  }

  return []; // All models failed
}

/**
 * Process multiple articles with OpenRouter
 * Uses batching to respect rate limits
 */
export async function processArticlesWithOpenRouter(
  articles: NewsItem[]
): Promise<NewsItem[]> {
  if (!isOpenRouterConfigured()) {
    console.warn("OpenRouter not configured, skipping AI processing");
    return articles;
  }

  const processed: NewsItem[] = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`Processing article ${i + 1}/${articles.length}: ${article.title.substring(0, 50)}...`);

    try {
      const tags = await generateTagsWithOpenRouter(article.title, article.summary);
      
      // Merge new tags with existing
      const mergedTags = Array.from(new Set([...tags, ...article.tags]));
      
      processed.push({
        ...article,
        tags: mergedTags.slice(0, 8)
      });

      // Rate limit delay
      if (i < articles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to process article: ${article.title}`, error);
      processed.push(article); // Keep original
    }
  }

  return processed;
}
