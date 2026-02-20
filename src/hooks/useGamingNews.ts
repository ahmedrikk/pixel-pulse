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
  { url: "https://www.dexerto.com/feed", source: "Dexerto" },
  { url: "https://www.sportskeeda.com/feed/esports", source: "Sportskeeda" },
  { url: "https://www.eurogamer.net/feed/news", source: "Eurogamer" },
  { url: "https://www.pcgamer.com/rss/", source: "PCGamer" },
  { url: "https://www.rockpapershotgun.com/feed", source: "RPS" },
  { url: "https://www.gematsu.com/feed", source: "Gematsu" },
  { url: "https://www.vg247.com/feed", source: "VG247" },
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
  if (text.includes("indie") || text.includes("hollow knight") || text.includes("celeste")) return "Indie";
  if (text.includes("esport") || text.includes("tournament") || text.includes("championship")) return "Esports";

  return "Gaming";
}

// Infer tags from content with source-specific defaults
function inferTags(title: string, content: string, source: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const tags: string[] = [];

  // Platform tags
  if (text.includes("playstation") || text.includes("ps5") || text.includes("ps4") || text.includes("sony")) tags.push("PlayStation");
  if (text.includes("xbox") || text.includes("microsoft") || text.includes("game pass")) tags.push("Xbox");
  if (text.includes("nintendo") || text.includes("switch")) tags.push("Nintendo");
  if (text.includes("pc") || text.includes("steam") || text.includes("nvidia") || text.includes("amd")) tags.push("PCGaming");

  // Genre tags
  if (text.includes("fps") || text.includes("shooter") || text.includes("call of duty") || text.includes("valorant")) tags.push("FPS");
  if (text.includes("rpg") || text.includes("final fantasy") || text.includes("elden ring")) tags.push("RPG");
  if (text.includes("indie") || text.includes("hollow knight")) tags.push("Indie");
  if (text.includes("moba") || text.includes("league of legends") || text.includes("dota")) tags.push("MOBA");
  if (text.includes("overwatch") || text.includes("ow2")) tags.push("Overwatch");

  // Streaming tags
  if (text.includes("twitch") || text.includes("stream")) tags.push("Twitch");
  if (text.includes("youtube")) tags.push("YouTube");
  if (text.includes("kick")) tags.push("Kick");

  // Streamer tags
  if (text.includes("kai cenat") || text.includes("kaicenat")) tags.push("KaiCenat");
  if (text.includes("xqc")) tags.push("xQc");
  if (text.includes("ninja")) tags.push("Ninja");
  if (text.includes("pokimane")) tags.push("Pokimane");
  if (text.includes("irl") || text.includes("just chatting")) tags.push("IRL");

  // Esports tags
  if (text.includes("esport") || text.includes("tournament") || text.includes("championship") || text.includes("competitive")) tags.push("Esports");
  if (text.includes("ranked") || text.includes("ladder")) tags.push("Ranked");

  // Source-specific default tags to ensure diversity
  const sourceDefaults: Record<string, string[]> = {
    "Dexerto": ["Streamers", "Twitch", "YouTube"],
    "Sportskeeda": ["Esports", "Competitive", "Tournaments", "Ranked"],
    "IGN": ["Reviews", "Gaming", "News", "Industry"],
    "GameSpot": ["Reviews", "Gaming", "Previews", "Industry"],
    "Kotaku": ["Culture", "Gaming", "Opinion", "Industry"],
    "Polygon": ["Culture", "Gaming", "Reviews"],
    "Eurogamer": ["Reviews", "Gaming", "News", "UK"],
    "PCGamer": ["PCGaming", "Hardware", "Mods", "Reviews"],
    "RPS": ["PCGaming", "Indie", "Reviews", "Opinion"],
    "Gematsu": ["JRPG", "News", "Japanese", "Industry"],
    "VG247": ["News", "Gaming", "Guide", "Reviews"],
  };

  // Add source defaults that aren't already present
  const defaults = sourceDefaults[source] || ["Gaming", "News", "Industry", "Entertainment"];
  for (const tag of defaults) {
    if (!tags.includes(tag) && tags.length < 6) {
      tags.push(tag);
    }
  }

  // Ensure we always have at least 4 tags
  const fallbackTags = ["Gaming", "News", "Trending", "Community"];
  for (const fallback of fallbackTags) {
    if (!tags.includes(fallback) && tags.length < 4) {
      tags.push(fallback);
    }
  }


  // GENERALIZED GAMING RULE
  // If we have any specific gaming tags, ensure "Gaming" is present and "Entertainment" is absent
  const specificGamingTags = [
    "PlayStation", "Xbox", "Nintendo", "PCGaming",
    "FPS", "RPG", "Indie", "MOBA", "Overwatch",
    "Esports", "Ranked", "Steam", "Switch", "PS5"
  ];

  const hasGamingContent = tags.some(tag => specificGamingTags.includes(tag)) || tags.includes("Gaming");

  if (hasGamingContent) {
    if (!tags.includes("Gaming")) tags.push("Gaming");

    // Remove Entertainment if present
    const entIndex = tags.indexOf("Entertainment");
    if (entIndex > -1) tags.splice(entIndex, 1);
  }

  return tags.slice(0, 6);
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
      const category = inferCategory(item.title, content);

      return {
        id: `${feedConfig.source}-${index}-${Date.now()}`,
        title: item.title,
        summary: summary || "Click to read the full article for more details.",
        sourceUrl: item.link,
        imageUrl,
        category,
        timestamp: item.pubDate,
        source: feedConfig.source,
        author: item.author || "Staff Writer",
        tags: inferTags(item.title, content, feedConfig.source),
        likes: Math.floor(Math.random() * 500) + 50,
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
            const processed = data.processedArticles[index];

            // Merge existing tags with AI tags, avoiding duplicates
            const aiTags = processed.processedTags || [];
            const uniqueTags = Array.from(new Set([...article.tags, ...aiTags]));

            // Re-apply the "Gaming" vs "Entertainment" rule just in case AI added "Entertainment"
            if (uniqueTags.some(tag =>
              ["PlayStation", "Xbox", "Nintendo", "PCGaming", "FPS", "RPG", "Indie", "MOBA", "Overwatch", "Esports", "Ranked", "Steam", "Switch", "PS5"].includes(tag)
              || uniqueTags.includes("Gaming")
            )) {
              if (!uniqueTags.includes("Gaming")) uniqueTags.push("Gaming");
              const entIndex = uniqueTags.indexOf("Entertainment");
              if (entIndex > -1) uniqueTags.splice(entIndex, 1);
            }

            return {
              ...article,
              title: processed.processedTitle || article.title,
              summary: processed.processedSummary || article.summary,
              tags: uniqueTags.slice(0, 8) // Limit to 8 tags max
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
      allNews.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
      });

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
