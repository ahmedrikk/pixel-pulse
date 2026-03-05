/**
 * OpenRouter API Client
 * Direct client for generating smart hashtags using OpenRouter
 * Used as fallback when Supabase edge function is unavailable
 */

import { NewsItem } from "@/data/mockNews";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = "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";

// Models to try in order of preference
const MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3-haiku",
  "meta-llama/llama-3.1-8b-instruct",
];

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Generate smart hashtags for a single article using OpenRouter
 */
export async function generateTagsWithOpenRouter(
  title: string,
  content: string
): Promise<string[]> {
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
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Pixel Pulse",
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
