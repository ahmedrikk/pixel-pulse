import { useState, useEffect, useCallback, useRef } from "react";
import { INITIAL_NEWS, NewsItem } from "@/data/mockNews";
import { supabase } from "@/integrations/supabase/client";
import { 
  getCachedArticles, 
  saveArticlesToCache, 
  updateArticlesWithAI,
  getAllCachedArticles,
  shouldRefreshCache 
} from "@/lib/newsCache";
import { mergeTags } from "@/lib/smartTagGenerator";

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

// Enforce 280-character hard cap at word boundary
function cap280(text: string): string {
  if (!text || text.length <= 280) return text;
  const cut = text.substring(0, 279);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 200 ? cut.substring(0, lastSpace) : cut) + "…";
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

/**
 * Process only new articles with AI (not cached)
 */
async function processNewArticlesWithAI(articles: NewsItem[]): Promise<NewsItem[]> {
  if (articles.length === 0) return [];

  console.log(`Processing ${articles.length} NEW articles with AI...`);

  try {
    const articlesToProcess = articles.map(article => ({
      title: article.title,
      content: article.summary,
      source: article.source,
      sourceUrl: article.sourceUrl,
      originalTags: article.tags,
    }));

    const { data, error: fnError } = await supabase.functions.invoke('process-article', {
      body: { articles: articlesToProcess }
    });

    if (fnError) {
      console.error("Edge function error:", fnError);
      // Fall back to smart tag generation
      return articles.map(article => ({
        ...article,
        tags: mergeTags([], article.tags, article.title, article.summary)
      }));
    }

    if (data?.processedArticles) {
      const processedArticles: NewsItem[] = [];
      const aiUpdates: { sourceUrl: string; aiTitle?: string; aiSummary?: string; tags: string[] }[] = [];

      articles.forEach((article, index) => {
        if (index < data.processedArticles.length) {
          const processed = data.processedArticles[index];
          const aiTags = processed.processedTags || [];
          
          // Merge AI tags with smart tags
          const mergedTags = mergeTags(aiTags, article.tags, article.title, article.summary);

          const processedArticle: NewsItem = {
            ...article,
            title: processed.processedTitle || article.title,
            summary: cap280(processed.processedSummary || article.summary),
            tags: mergedTags,
          };

          processedArticles.push(processedArticle);

          // Track for cache update
          aiUpdates.push({
            sourceUrl: article.sourceUrl,
            aiTitle: processed.processedTitle,
            aiSummary: processed.processedSummary,
            tags: mergedTags,
          });
        } else {
          processedArticles.push(article);
        }
      });

      // Update cache with AI data in background
      updateArticlesWithAI(aiUpdates).catch(console.error);

      return processedArticles;
    }

    return articles;
  } catch (err) {
    console.error("AI processing error:", err);
    // Fall back to smart tag generation
    return articles.map(article => ({
      ...article,
      tags: mergeTags([], article.tags, article.title, article.summary)
    }));
  }
}

export function useGamingNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Track if initial load is complete
  const initialLoadComplete = useRef(false);

  /**
   * Main fetch function - uses cache first, then updates in background
   */
  const fetchAllFeeds = useCallback(async (forceRefresh = false) => {
    // Show loading state on first load or force refresh
    if (!initialLoadComplete.current || forceRefresh) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    setError(null);

    try {
      // Step 1: Try to load from cache immediately (fast!)
      if (!forceRefresh && initialLoadComplete.current) {
        const cached = await getAllCachedArticles();
        if (cached.length > 0) {
          console.log(`Loaded ${cached.length} articles from cache instantly`);
          setNews(cached);
          setIsLoading(false);
          // Continue to check for updates in background
        }
      }

      // Step 2: Fetch fresh RSS feeds
      console.log("Fetching fresh RSS feeds...");
      const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
      let freshArticles = results.flat();

      if (freshArticles.length === 0) {
        throw new Error("No articles fetched from any feed");
      }

      // Step 3: Check cache to find which articles are new
      const articleUrls = freshArticles.map(a => a.sourceUrl);
      const { cached, uncachedUrls } = await getCachedArticles(articleUrls);

      console.log(`Cache status: ${cached.length} cached, ${uncachedUrls.length} new articles`);

      // Step 4: Process only NEW articles with AI
      const newArticles = freshArticles.filter(a => uncachedUrls.includes(a.sourceUrl));
      const processedNewArticles = await processNewArticlesWithAI(newArticles);

      // Step 5: Merge cached + processed new articles
      const cachedMap = new Map(cached.map(a => [a.sourceUrl, a]));
      const processedMap = new Map(processedNewArticles.map(a => [a.sourceUrl, a]));

      const mergedArticles = freshArticles.map(article => {
        // Prefer processed new article, then cached, then original
        return processedMap.get(article.sourceUrl) || 
               cachedMap.get(article.sourceUrl) || 
               article;
      });

      // Step 6: Save new articles to cache
      const articlesToCache = processedNewArticles.length > 0 
        ? processedNewArticles 
        : newArticles.map(a => ({
            ...a,
            tags: mergeTags([], a.tags, a.title, a.summary)
          }));
      
      if (articlesToCache.length > 0) {
        saveArticlesToCache(articlesToCache).catch(console.error);
      }

      // Step 7: Sort and update UI
      mergedArticles.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
      });

      setNews(mergedArticles);
      setLastUpdated(new Date());
      setIsUsingFallback(false);
      initialLoadComplete.current = true;

    } catch (err) {
      console.error("Failed to fetch news feeds:", err);
      
      // Try to load from cache as fallback
      const cached = await getAllCachedArticles();
      if (cached.length > 0) {
        console.log("Using cached articles due to fetch error");
        setNews(cached);
        setError("Using cached articles. Some content may be outdated.");
      } else {
        // Ultimate fallback: mock data
        setError("Could not load live news. Showing offline archives.");
        setNews(INITIAL_NEWS);
        setIsUsingFallback(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Initial load - check cache first
   */
  useEffect(() => {
    const init = async () => {
      // Try to load from cache immediately
      const shouldRefresh = await shouldRefreshCache();
      
      if (!shouldRefresh) {
        const cached = await getAllCachedArticles();
        if (cached.length > 0) {
          console.log(`Initial load: ${cached.length} articles from cache`);
          setNews(cached);
          setIsLoading(false);
          initialLoadComplete.current = true;
          
          // Check for updates in background after a delay
          setTimeout(() => fetchAllFeeds(false), 2000);
          return;
        }
      }
      
      // No cache or expired, fetch fresh
      fetchAllFeeds(false);
    };
    
    init();
  }, [fetchAllFeeds]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(async () => {
    await fetchAllFeeds(true);
  }, [fetchAllFeeds]);

  return { 
    news, 
    isLoading, 
    isRefreshing,
    error, 
    isUsingFallback, 
    lastUpdated,
    refresh 
  };
}
