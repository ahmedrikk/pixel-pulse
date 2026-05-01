import { supabase } from '@/integrations/supabase/client';

export const ESPORTS_NEWS_SOURCES = [
  { name: 'Esports Insider', rssFeed: 'https://esportsinsider.com/feed', displayName: 'Esports Insider' },
  { name: 'Sheep Esports', rssFeed: 'https://www.sheepesports.com/feed', displayName: 'Sheep Esports' },
  { name: 'Escharts', rssFeed: 'https://escharts.com/news/rss', displayName: 'Escharts' },
];

export function detectGameTag(title: string): string | null {
  const tags: Record<string, string[]> = {
    valorant: ['valorant', 'vct', 'vcl'],
    cs2: ['cs2', 'counter-strike', 'csgo', 'esl', 'blast'],
    lol: ['league of legends', 'lol', 'lck', 'lec', 'lcs'],
    dota2: ['dota 2', 'dota2', 'ti', 'dreamleague'],
    overwatch2: ['overwatch', 'owl'],
    rainbow6: ['rainbow six', 'r6', 'six invitational'],
    'mobile-legends': ['mobile legends', 'mlbb', 'mpl'],
    'king-of-glory': ['king of glory', 'kog'],
  };
  const lower = title.toLowerCase();
  for (const [tag, keywords] of Object.entries(tags)) {
    if (keywords.some(kw => lower.includes(kw))) return tag;
  }
  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateSnippet(content: string): string {
  const clean = stripHtml(content);
  return clean.length > 300 ? clean.slice(0, 300) + '…' : clean;
}

export interface EsportsNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
  imageUrl: string | null;
  gameTag: string | null;
}

export async function fetchEsportsRss(sourceUrl: string): Promise<EsportsNewsItem[]> {
  const res = await fetch(sourceUrl, {
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const items: EsportsNewsItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    const link = block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim() || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1]?.trim() || new Date().toISOString();
    const description = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    const imageUrl = block.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1]
      || block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1]
      || description.match(/<img[^>]+src="([^"]+)"/i)?.[1]
      || null;

    if (title && link) {
      items.push({ title, link, pubDate, source: '', description, imageUrl, gameTag: detectGameTag(title) });
    }
  }
  return items;
}

export async function ingestEsportsNews(): Promise<number> {
  let inserted = 0;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  for (const source of ESPORTS_NEWS_SOURCES) {
    try {
      const items = await fetchEsportsRss(source.rssFeed);
      for (const item of items.slice(0, 10)) {
        const { error } = await supabase.from('cached_articles').upsert({
          original_id: `${source.displayName}-${item.link.slice(-40)}`,
          title: item.title,
          summary: generateSnippet(item.description || item.title),
          source_url: item.link,
          image_url: item.imageUrl || '',
          category: 'esports',
          source: source.displayName,
          author: 'Staff Writer',
          ai_title: item.title,
          ai_summary: generateSnippet(item.description || item.title),
          tags: item.gameTag ? [item.gameTag] : [],
          likes: 0,
          article_date: new Date(item.pubDate).toISOString(),
          expires_at: expiresAt.toISOString(),
        }, { onConflict: 'source_url' });

        if (error) {
          console.error(`Upsert error for ${item.title}:`, error);
        } else {
          inserted++;
        }
      }
    } catch (err) {
      console.error(`Failed to ingest ${source.name}:`, err);
    }
  }
  return inserted;
}
