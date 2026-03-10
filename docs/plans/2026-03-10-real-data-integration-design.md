# Real Data Integration Design
**Date:** 2026-03-10
**Status:** Approved

## Goal
Replace all mock/static data with live API data across the LevelUpXP app.

## Data Sources
| Source | Purpose | Auth |
|---|---|---|
| RAWG.io | Primary game catalog — all platforms, covers, genres, Metacritic scores | `VITE_RAWG_API_KEY` |
| OpenCritic | Critic review scores (IGN, GameSpot, Eurogamer, etc.) | None required |
| Steam Store API | Supplemental PC game data (price, screenshots) | Proxied via `/api/steam`, key in `VITE_STEAM_API_KEY` |
| PandaScore | Live/upcoming/past esports matches | `VITE_PANDASCORE_API_KEY` (already wired) |
| Supabase | Cache game data (24h TTL) + store user reviews + auth user profile | `VITE_SUPABASE_*` |

## New Environment Variable
```
VITE_RAWG_API_KEY=0f872a646cda48ecb058d34e893d96ac
```

## New Supabase Tables

### `games`
```sql
id            text primary key,       -- RAWG slug
name          text not null,
slug          text not null,
cover_image   text,
genres        text[],
platforms     text[],
release_date  text,
rawg_rating   float,
metacritic_score int,
steam_appid   int,
opencritic_id int,
opencritic_score float,
description   text,
expires_at    timestamptz not null
```

### `user_game_reviews`
```sql
id            uuid primary key default gen_random_uuid(),
user_id       uuid references auth.users not null,
game_id       text references games(id) not null,
star_rating   int check (star_rating between 1 and 5),
review_text   text,
tags          text[],
helpful_votes int default 0,
created_at    timestamptz default now()
```

## New API Clients
- `src/lib/rawg.ts` — `fetchGameList(params)`, `fetchGameDetail(slug)`
- `src/lib/opencritic.ts` — `searchGame(name)`, `fetchCriticReviews(id)`

## New Hooks
- `src/hooks/useGameCatalog.ts` — RAWG list → Supabase cache → component
- `src/hooks/useGameDetails.ts` — RAWG detail + Steam supplemental data
- `src/hooks/useGameReviews.ts` — OpenCritic critic scores + Supabase user reviews

## Components to Update
| Component | Change |
|---|---|
| `GameCatalog.tsx` | Replace `CATALOG_GAMES` with `useGameCatalog()` |
| `GameReview.tsx` | Replace `GAME_DATABASE` with `useGameDetails()` + `useGameReviews()` |
| `Esports.tsx` | Replace `ESPORTS_MATCHES` with `useEsportsMatches()` (hook already built) |
| `RightSidebar.tsx` | Replace `LIVE_MATCH` + `ESPORTS_MATCHES` with `useEsportsMatches()` live data |
| `UserProfileCard.tsx` | Replace `MOCK_USER` with Supabase `auth.users` + `profiles` table |

## Caching Strategy
- `games` table: 24h TTL via `expires_at` column — same pattern as `cached_articles`
- On load: check Supabase first, fetch RAWG if expired/missing, write back to cache
- OpenCritic scores: fetched fresh per game detail page (low request volume)
