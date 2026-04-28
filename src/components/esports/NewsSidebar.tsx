import React from 'react';
import { type NewsItem } from '@/data/mockNews';
import { formatDistanceToNow, parseISO } from 'date-fns';

// Map tags to game IDs
const TAG_GAME_MAP: Record<string, string> = {
  'FPS': 'cs2',
  'Valorant': 'valorant',
  'Esports': 'all',
  'Twitch': 'all',
  'Streaming': 'valorant',
  'cs2': 'cs2',
  'valorant': 'valorant',
  'dota2': 'dota2',
  'lol': 'lol',
};

const GAME_TAG_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  valorant:  { bg: '#EEEDFE', color: '#3C3489', label: 'Valorant' },
  cs2:       { bg: '#FEF2F2', color: '#991B1B', label: 'CS2' },
  dota2:     { bg: '#E1F5EE', color: '#085041', label: 'Dota 2' },
  lol:       { bg: '#FAEEDA', color: '#633806', label: 'LoL' },
  'mobile-legends': { bg: '#EAF3DE', color: '#166534', label: 'ML' },
  all:       { bg: '#F3F4F6', color: '#374151', label: 'Esports' },
};

function getGameTag(item: NewsItem): string {
  for (const tag of item.tags) {
    if (TAG_GAME_MAP[tag]) return TAG_GAME_MAP[tag];
  }
  const cat = item.category?.toLowerCase();
  if (cat?.includes('esports') || cat?.includes('fps')) return 'cs2';
  return 'all';
}

interface NewsSidebarProps {
  news: NewsItem[];
  activeGame: string;
  isLoading: boolean;
}

export function NewsSidebar({ news, activeGame, isLoading }: NewsSidebarProps) {
  // Filter client-side
  const filtered = activeGame === 'all'
    ? news
    : news.filter(item => {
        const gameTag = getGameTag(item);
        return gameTag === activeGame || gameTag === 'all';
      });

  const displayed = filtered.slice(0, 12);

  const gameStyle = GAME_TAG_STYLES[activeGame] || GAME_TAG_STYLES['all'];
  const title = activeGame === 'all' ? 'Esports news' : `${gameStyle.label} news`;
  const filterLabel = activeGame === 'all' ? 'All games' : `${gameStyle.label} only`;

  return (
    <div style={{
      width: 320,
      flexShrink: 0,
      background: 'hsl(var(--background))',
      padding: 14,
      borderLeft: '0.5px solid hsl(var(--border))',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: 10, color: '#534AB7', fontWeight: 500 }}>{filterLabel} ▾</span>
      </div>

      {isLoading ? (
        <div>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 60, background: 'hsl(var(--secondary))', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '20px 0' }}>
          No {activeGame === 'all' ? 'esports' : gameStyle.label} news available.
        </p>
      ) : (
        <div>
          {displayed.map((item, i) => {
            const gameTag = getGameTag(item);
            const tagStyle = GAME_TAG_STYLES[gameTag] || GAME_TAG_STYLES['all'];
            return (
              <div
                key={item.id}
                style={{
                  padding: '10px 0',
                  borderBottom: i < displayed.length - 1 ? '0.5px solid hsl(var(--border))' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => item.sourceUrl && window.open(item.sourceUrl, '_blank')}
              >
                {/* Game tag pill */}
                <span style={{
                  fontSize: 9,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 5,
                  marginBottom: 5,
                  display: 'inline-flex',
                  background: tagStyle.bg,
                  color: tagStyle.color,
                }}>
                  {tagStyle.label}
                </span>

                {/* Headline */}
                <p style={{
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  marginBottom: 4,
                  color: 'hsl(var(--foreground))',
                }}>
                  {item.title}
                </p>

                {/* Snippet */}
                <p style={{
                  fontSize: 10,
                  color: 'hsl(var(--muted-foreground))',
                  lineHeight: 1.5,
                  marginBottom: 5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as React.CSSProperties}>
                  {item.summary}
                </p>

                {/* Meta row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary, hsl(var(--muted-foreground)))' }}>
                    {item.source} · {item.timestamp ? formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true }) : ''}
                  </span>
                  <span style={{ fontSize: 10, color: '#534AB7' }}>Read →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
