import Parser from 'rss-parser';

// IMPORTANT: This file contains the logic requested for backend ingestion.
// Since this is a Vite + Supabase Edge Functions project, you should move this 
// logic into your `supabase/functions/fetch-news/index.ts` or a new edge function.

const parser = new Parser();

export const ESPORTS_NEWS_SOURCES = [
  {
    name: 'Esports Insider',
    url: 'https://esportsinsider.com/',
    rssFeed: 'https://esportsinsider.com/feed',
    displayName: 'Esports Insider',
  },
  {
    name: 'Sheep Esports',
    url: 'https://www.sheepesports.com/en/all',
    rssFeed: 'https://www.sheepesports.com/feed',
    displayName: 'Sheep Esports',
  },
  {
    name: 'Escharts',
    url: 'https://escharts.com/news',
    rssFeed: 'https://escharts.com/news/rss',
    displayName: 'Escharts',
  },
];

export interface EsportsNewsArticle {
  id: string;
  headline: string;
  snippet: string;        // AI-generated 2-sentence summary
  source: string;         // 'Esports Insider' | 'Sheep Esports' | 'Escharts'
  sourceUrl: string;      // original article URL
  publishedAt: Date;
  gameTag: string | null; // auto-detected from title/content
  imageUrl: string | null;
}

export async function ingestEsportsNews(db: any): Promise<void> {
  for (const source of ESPORTS_NEWS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.rssFeed);

      for (const item of feed.items.slice(0, 20)) {
        // Mock DB check
        const existing = await db.esportsNews?.findFirst({
          where: { sourceUrl: item.link }
        });

        if (existing) continue; // skip duplicates

        // Auto-detect game tag from title
        const gameTag = detectGameTag(item.title || '');

        // Generate 2-sentence AI snippet
        const snippet = await generateSnippet(item.contentSnippet || item.title || '');

        // Mock DB create
        await db.esportsNews?.create({
          data: {
            headline: item.title || '',
            snippet,
            source: source.displayName,
            sourceUrl: item.link || '',
            publishedAt: new Date(item.pubDate || Date.now()),
            gameTag,
            imageUrl: extractImageFromItem(item),
          }
        });
      }
    } catch (err) {
      console.error(`Failed to ingest ${source.name}:`, err);
    }
  }
}

export function detectGameTag(title: string): string | null {
  const tags: Record<string, string[]> = {
    'valorant':           ['valorant', 'vct', 'vcl'],
    'cs2':                ['cs2', 'counter-strike', 'csgo', 'esl', 'blast'],
    'lol':                ['league of legends', 'lol', 'lck', 'lec', 'lcs'],
    'dota2':              ['dota 2', 'dota2', 'ti', 'dreamleague'],
    'overwatch2':         ['overwatch', 'owl'],
    'rainbow6':           ['rainbow six', 'r6', 'six invitational'],
    'mobile-legends':     ['mobile legends', 'mlbb', 'mpl'],
    'king-of-glory':      ['king of glory', 'kog'],
  };

  const lower = title.toLowerCase();
  for (const [tag, keywords] of Object.entries(tags)) {
    if (keywords.some(kw => lower.includes(kw))) return tag;
  }
  return null; // general esports article — shows in All games filter
}

async function generateSnippet(content: string): Promise<string> {
  // Placeholder for AI snippet generation (e.g., using OpenAI or Groq)
  return content.slice(0, 150) + '...';
}

function extractImageFromItem(item: any): string | null {
  // Try to find image in enclosure or content
  if (item.enclosure?.url) return item.enclosure.url;
  const imgMatch = item.content?.match(/<img[^>]+src="([^">]+)"/);
  return imgMatch ? imgMatch[1] : null;
}
