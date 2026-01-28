import { useState, useEffect, useCallback } from "react";
import { INITIAL_NEWS, NewsItem } from "@/data/mockNews";
import { supabase } from "@/integrations/supabase/client";

interface RssItem {
  title: string;
  link: string;
  description: string;
  content?: string;
  pubDate: string;
  enclosure?: { link: string };
  thumbnail?: string;
  author?: string;
}

interface RssFeed {
  status: string;
  feed: { title: string };
  items: RssItem[];
}

const RSS_FEEDS = [
  { url: "https://feeds.ign.com/ign/news", source: "IGN" },
  { url: "https://www.gamespot.com/feeds/news/", source: "GameSpot" },
  { url: "https://kotaku.com/rss", source: "Kotaku" },
  { url: "https://www.polygon.com/rss/index.xml", source: "Polygon" },
];

const RSS2JSON_API = "https://api.rss2json.com/v1/api.json?rss_url=";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=400&fit=crop";

// Strip HTML tags from content
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

// Extract image from HTML content
function extractImageFromHtml(html: string): string | null {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : null;
}

// Infer category from content
function inferCategory(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase();
  
  if (text.includes("playstation") || text.includes("ps5") || text.includes("ps4") || text.includes("sony")) return "PlayStation";
  if (text.includes("xbox") || text.includes("microsoft") || text.includes("game pass")) return "Xbox";
  if (text.includes("nintendo") || text.includes("switch") || text.includes("zelda") || text.includes("mario")) return "Nintendo";
  if (text.includes("pc") || text.includes("steam") || text.includes("nvidia") || text.includes("amd") || text.includes("gpu")) return "PCGaming";
  if (text.includes("fps") || text.includes("shooter") || text.includes("call of duty") || text.includes("valorant") || text.includes("counter-strike")) return "FPS";
  if (text.includes("rpg") || text.includes("final fantasy") || text.includes("elden ring") || text.includes("baldur")) return "RPG";
  if (text.includes("indie") || text.includes("hollow knight") || text.includes("celeste")) return "IndieGames";
  if (text.includes("esport") || text.includes("tournament") || text.includes("championship")) return "Esports";
  
  return "Gaming";
}

async function fetchFeed(feedConfig: { url: string; source: string }): Promise<NewsItem[]> {
  try {
    const response = await fetch(`${RSS2JSON_API}${encodeURIComponent(feedConfig.url)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data: RssFeed = await response.json();
    if (data.status !== "ok") throw new Error("Feed status not ok");

    return data.items.slice(0, 5).map((item, index) => {
      const content = item.content || item.description || "";
      
      // Try multiple sources for the image
      const imageUrl = 
        item.enclosure?.link ||
        item.thumbnail ||
        extractImageFromHtml(content) ||
        FALLBACK_IMAGE;

      // Use full description without truncation
      const summary = stripHtml(item.description || item.content || "");

      return {
        id: `${feedConfig.source}-${index}-${Date.now()}`,
        title: item.title,
        summary: summary || "Click to read the full article for more details.",
        sourceUrl: item.link,
        imageUrl,
        category: inferCategory(item.title, content),
        timestamp: item.pubDate,
        source: feedConfig.source,
        author: item.author || "Staff Writer",
      };
    });
  } catch (error) {
    console.error(`Failed to fetch ${feedConfig.source}:`, error);
    return [];
  }
}

export function useGamingNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const processArticlesWithAI = useCallback(async (articles: NewsItem[]): Promise<NewsItem[]> => {
    try {
      console.log("Processing articles with Gemini AI...");
      
      // Process first 10 articles to avoid rate limits
      const articlesToProcess = articles.slice(0, 10).map(article => ({
        title: article.title,
        content: article.summary,
        source: article.source,
      }));

      const { data, error: fnError } = await supabase.functions.invoke('process-article', {
        body: { articles: articlesToProcess }
      });

      if (fnError) {
        console.error("Edge function error:", fnError);
        return articles;
      }

      if (data?.processedArticles) {
        console.log("AI processing complete, updating articles...");
        return articles.map((article, index) => {
          if (index < data.processedArticles.length) {
            return {
              ...article,
              title: data.processedArticles[index].processedTitle || article.title,
              summary: data.processedArticles[index].processedSummary || article.summary,
            };
          }
          return article;
        });
      }

      return articles;
    } catch (err) {
      console.error("AI processing error:", err);
      return articles;
    }
  }, []);

  const fetchAllFeeds = useCallback(async (enableAI: boolean = true) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
      let allNews = results.flat();

      if (allNews.length === 0) {
        throw new Error("No articles fetched from any feed");
      }

      // Sort by date (newest first)
      allNews.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Process with AI if enabled
      if (enableAI) {
        allNews = await processArticlesWithAI(allNews);
      }

      setNews(allNews);
      setIsUsingFallback(false);
    } catch (err) {
      console.error("Failed to fetch news feeds:", err);
      setError("Could not load live news. Showing offline archives.");
      setNews(INITIAL_NEWS);
      setIsUsingFallback(true);
    } finally {
      setIsLoading(false);
    }
  }, [processArticlesWithAI]);

  useEffect(() => {
    fetchAllFeeds(true);
  }, [fetchAllFeeds]);

  const refresh = useCallback(async () => {
    await fetchAllFeeds(true);
  }, [fetchAllFeeds]);

  return { news, isLoading, error, isUsingFallback, refresh };
}
