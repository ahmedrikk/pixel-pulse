# Design: Live Esports Scores + Esports News Integration

**Date:** 2026-02-20
**Status:** Approved

---

## Goal

Replace hardcoded mock data in the RightSidebar with real live esports match scores from PandaScore, and enrich the main news feed with esports articles from PandaScore's news endpoint.

---

## Approach

**Option A — Direct frontend calls with React Query**

- PandaScore API key stored in `.env` as `VITE_PANDASCORE_API_KEY`
- New `useEsportsScores` hook using React Query (already installed) with 60s auto-refetch
- `useGamingNews` extended to fetch + merge PandaScore articles
- No backend changes needed

---

## Architecture

```
PandaScore API (api.pandascore.co)
  ├── GET /matches?filter[status]=running           → live matches (up to 5)
  ├── GET /matches?filter[status]=not_started       → upcoming matches (next 3)
  └── GET /articles                                 → esports news articles

React Query (refetchInterval: 60s for scores)
  ↓
useEsportsScores hook → RightSidebar (Live + Upcoming widgets)
useGamingNews hook    → main NewsFeed (merged with RSS articles)
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `.env` | Edit | Add `VITE_PANDASCORE_API_KEY` |
| `src/hooks/useEsportsScores.ts` | Create | New hook for live + upcoming matches |
| `src/hooks/useGamingNews.ts` | Edit | Add PandaScore articles fetching + merge |
| `src/components/RightSidebar.tsx` | Edit | Replace static widgets with live data |
| `src/lib/pandascore.ts` | Create | PandaScore API client + types |

---

## Data Shapes

### PandaScore Match (simplified)
```typescript
interface PandaScoreMatch {
  id: number;
  name: string;
  status: 'running' | 'not_started' | 'finished';
  begin_at: string;
  videogame: { name: string; slug: string };
  tournament: { name: string };
  league: { name: string };
  opponents: Array<{ opponent: { name: string; image_url: string } }>;
  results: Array<{ score: number; team_id: number }>;
  streams_list: Array<{ raw_url: string; main: boolean; language: string }>;
}
```

### PandaScore Article (simplified)
```typescript
interface PandaScoreArticle {
  id: number;
  title: string;
  description: string;
  slug: string;
  published_at: string;
  thumbnail?: { url: string };
  videogames: Array<{ name: string }>;
}
```

### NewsItem (existing)
```typescript
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  imageUrl: string;
  category: string;
  timestamp: string;
  source: string;
  author: string;
  tags: string[];
  likes?: number;
}
```

---

## UI Changes

### RightSidebar — Live Matches widget
- Replace static `LIVE_MATCH` with live data from PandaScore
- Show up to 3 live matches, each with:
  - Game badge (CS2 / Valorant / LoL / Dota 2 etc.)
  - Team1 vs Team2 with scores
  - Tournament name
  - Watch button (if stream available)
- Loading skeleton while fetching
- "No live matches right now" fallback

### RightSidebar — Upcoming widget
- Replace hardcoded "League of Legends Worlds" with real next matches
- Show up to 3 upcoming matches with time until start

### Main NewsFeed — Esports Articles
- PandaScore articles mapped to `NewsItem` format
- Merged with RSS articles, sorted by date
- Tagged with `["Esports", "Gaming"]` + game-specific tags
- Source displayed as "PandaScore"

---

## Error Handling

- PandaScore unavailable → show empty state gracefully, no crash
- No live matches → show "No live matches right now" message
- Article fetch fail → RSS articles still display normally

---

## Environment Variables

```env
VITE_PANDASCORE_API_KEY=<provided key>
```

---

## Key Constraints

- API key is read-only and PandaScore is designed for client-side use
- Respect PandaScore rate limits (free tier: 1000 req/hour)
- React Query polling at 60s interval is well within limits
- No structural changes to existing `NewsItem` interface needed
