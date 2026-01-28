import { useState, useEffect } from "react";
import { NewsItem, INITIAL_NEWS } from "@/data/mockNews";

const RSS_FEEDS = [
  { url: "https://feeds.ign.com/ign/news", source: "IGN" },
  { url: "https://www.gamespot.com/feeds/news/", source: "GameSpot" },
  { url: "https://kotaku.com/rss", source: "Kotaku" },
  { url: "https://www.polygon.com/rss/index.xml", source: "Polygon" },
];

const RSS2JSON_API = "https://api.rss2json.com/v1/api.json?rss_url=";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=400&fit=crop";

// Strip HTML tags from description
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

// Extract first image from HTML content
function extractImageFromHtml(html: string): string | null {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : null;
}

// Determine category from title/content
function inferCategory(title: string, content: string): string {
  const text = (title + " " + content).toLowerCase();
  if (text.includes("playstation") || text.includes("ps5") || text.includes("ps4")) return "PlayStation";
  if (text.includes("xbox") || text.includes("game pass")) return "Xbox";
  if (text.includes("pc") || text.includes("steam") || text.includes("nvidia") || text.includes("amd")) return "PCGaming";
  if (text.includes("indie") || text.includes("hollow knight") || text.includes("celeste")) return "IndieGames";
  if (text.includes("fps") || text.includes("shooter") || text.includes("call of duty") || text.includes("valorant")) return "FPS";
  return "RPG"; // Default category
}

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

async function fetchFeed(feedConfig: { url: string; source: string }): Promise<NewsItem[]> {
  try {
    const response = await fetch(`${RSS2JSON_API}${encodeURIComponent(feedConfig.url)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data: RssFeed = await response.json();
    if (data.status !== "ok") throw new Error("Feed status not ok");

    return data.items.slice(0, 5).map((item, index) => {
      const content = item.content || item.description || "";
      
      // Try multiple sources for the image
      let imageUrl = 
        item.enclosure?.link ||
        item.thumbnail ||
        extractImageFromHtml(content) ||
        FALLBACK_IMAGE;

      // Clean up summary
      const summary = stripHtml(item.description || "").slice(0, 400);

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

  useEffect(() => {
    async function fetchAllFeeds() {
      setIsLoading(true);
      setError(null);

      try {
        const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
        const allNews = results.flat();

        if (allNews.length === 0) {
          throw new Error("No articles fetched from any feed");
        }

        // Sort by date (newest first)
        allNews.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

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
    }

    fetchAllFeeds();
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
      const allNews = results.flat();
      
      if (allNews.length > 0) {
        allNews.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setNews(allNews);
        setError(null);
        setIsUsingFallback(false);
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return { news, isLoading, error, isUsingFallback, refresh };
}
