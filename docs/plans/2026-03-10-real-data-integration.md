# Real Data Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all mock/static data with live API data from RAWG.io, OpenCritic, PandaScore, and Supabase.

**Architecture:** RAWG.io is the primary game catalog source, cached in Supabase `games` table (24h TTL). OpenCritic provides critic scores fetched per game detail page. PandaScore (hook already built) replaces static esports arrays. Supabase auth replaces MOCK_USER.

**Tech Stack:** React Query (`@tanstack/react-query`), Supabase JS client, RAWG REST API, OpenCritic REST API, PandaScore REST API (already in `src/lib/pandascore.ts`)

---

### Task 1: Add RAWG API key to environment

**Files:**
- Modify: `.env`
- Modify: `.github/workflows/deploy.yml`

**Step 1: Add RAWG key to .env**

Append to `.env`:
```
VITE_RAWG_API_KEY=0f872a646cda48ecb058d34e893d96ac
```

**Step 2: Add RAWG key to GitHub Actions deploy workflow**

In `.github/workflows/deploy.yml`, under the `Build` step's `env:` block, add:
```yaml
VITE_RAWG_API_KEY: ${{ secrets.VITE_RAWG_API_KEY }}
```

**Step 3: Add secret to GitHub**

Go to repo Settings → Secrets → Actions → New repository secret:
- Name: `VITE_RAWG_API_KEY`
- Value: `0f872a646cda48ecb058d34e893d96ac`

**Step 4: Commit**
```bash
git add .env .github/workflows/deploy.yml
git commit -m "feat: add RAWG API key to env and CI"
```

---

### Task 2: Supabase migration — create `games` and `user_game_reviews` tables

**Files:**
- Create: `supabase/migrations/20260310000001_create_games_tables.sql`

**Step 1: Create migration file**

```sql
-- Games cache (from RAWG, 24h TTL)
create table if not exists public.games (
  id              text primary key,        -- RAWG slug
  name            text not null,
  slug            text not null,
  cover_image     text,
  genres          text[] default '{}',
  platforms       text[] default '{}',
  release_date    text,
  rawg_rating     float,
  metacritic_score int,
  steam_appid     int,
  opencritic_id   int,
  opencritic_score float,
  description     text,
  trending        boolean default false,
  expires_at      timestamptz not null
);

alter table public.games enable row level security;

create policy "games are publicly readable"
  on public.games for select using (true);

create policy "service role can write games"
  on public.games for all using (auth.role() = 'service_role');

-- Also allow anon/authenticated to upsert games (client-side cache writes)
create policy "authenticated can upsert games"
  on public.games for insert with check (true);

create policy "authenticated can update games"
  on public.games for update using (true);

-- User-submitted game reviews
create table if not exists public.user_game_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  game_id       text references public.games(id) not null,
  star_rating   int check (star_rating between 1 and 5) not null,
  review_text   text,
  tags          text[] default '{}',
  helpful_votes int default 0,
  created_at    timestamptz default now()
);

alter table public.user_game_reviews enable row level security;

create policy "reviews are publicly readable"
  on public.user_game_reviews for select using (true);

create policy "users can insert own reviews"
  on public.user_game_reviews for insert
  with check (auth.uid() = user_id);

create policy "users can update own reviews"
  on public.user_game_reviews for update
  using (auth.uid() = user_id);
```

**Step 2: Apply migration**
```bash
# If using Supabase CLI:
npx supabase db push
# Or apply manually in Supabase dashboard SQL editor
```

**Step 3: Commit**
```bash
git add supabase/migrations/20260310000001_create_games_tables.sql
git commit -m "feat: add games and user_game_reviews tables"
```

---

### Task 3: Create RAWG API client

**Files:**
- Create: `src/lib/rawg.ts`

**Step 1: Create the client**

```typescript
// src/lib/rawg.ts
const BASE = "https://api.rawg.io/api";
const KEY = import.meta.env.VITE_RAWG_API_KEY;

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  rating: number;           // 0–5
  metacritic: number | null;
  released: string | null;
  genres: { id: number; slug: string; name: string }[];
  platforms: { platform: { name: string } }[] | null;
  description_raw?: string;
  stores?: { store: { name: string } }[] | null;
}

export interface RawgListResponse {
  count: number;
  results: RawgGame[];
}

function rawgUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("key", KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export async function fetchGameList(params: {
  page?: number;
  page_size?: number;
  search?: string;
  genres?: string;       // comma-separated RAWG genre slugs
  ordering?: string;     // e.g. "-rating", "-metacritic", "-added"
} = {}): Promise<RawgListResponse> {
  const res = await fetch(
    rawgUrl("/games", {
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      ...(params.search && { search: params.search }),
      ...(params.genres && { genres: params.genres }),
      ordering: params.ordering ?? "-rating",
    })
  );
  if (!res.ok) throw new Error(`RAWG list failed: ${res.status}`);
  return res.json();
}

export async function fetchGameDetail(slug: string): Promise<RawgGame> {
  const res = await fetch(rawgUrl(`/games/${slug}`));
  if (!res.ok) throw new Error(`RAWG detail failed: ${res.status}`);
  return res.json();
}

// Map RAWG genre slug to app genre id
export const RAWG_GENRE_MAP: Record<string, string> = {
  "role-playing-games-rpg": "action-rpg",
  action: "action-rpg",
  shooter: "fps",
  adventure: "adventure",
  strategy: "strategy",
  horror: "horror",
  racing: "racing",
  sports: "sports",
};

// Normalise platform names from RAWG to app display names
export function normalisePlatforms(
  platforms: RawgGame["platforms"]
): string[] {
  if (!platforms) return [];
  const map: Record<string, string> = {
    PC: "PC",
    PlayStation: "PS5",
    "PlayStation 5": "PS5",
    "PlayStation 4": "PS4",
    Xbox: "Xbox",
    "Xbox One": "Xbox",
    "Xbox Series S/X": "Xbox",
    "Nintendo Switch": "Switch",
    iOS: "iOS",
    Android: "Android",
    macOS: "Mac",
  };
  const seen = new Set<string>();
  return platforms
    .map((p) => map[p.platform.name] ?? p.platform.name)
    .filter((n) => {
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
}
```

**Step 2: Commit**
```bash
git add src/lib/rawg.ts
git commit -m "feat: add RAWG API client"
```

---

### Task 4: Create OpenCritic API client

**Files:**
- Create: `src/lib/opencritic.ts`

**Step 1: Create the client**

```typescript
// src/lib/opencritic.ts
// OpenCritic public API — no auth required
const BASE = "https://api.opencritic.com/api";

export interface OpenCriticGame {
  id: number;
  name: string;
  percentRecommended: number | null;  // % of critics who recommend
  numReviews: number;
  numTopCriticReviews: number;
  medianScore: number | null;
  topCriticScore: number | null;      // 0–100 aggregate score
  tier: "Mighty" | "Strong" | "Fair" | "Weak" | null;
}

export interface OpenCriticReview {
  id: number;
  score: number | null;
  snippet: string;
  publishedDate: string;
  externalUrl: string;
  outlet: { id: number; name: string; imageUrl?: { og?: string } };
  authors: { name: string }[];
}

export interface OpenCriticDetail extends OpenCriticGame {
  reviews: OpenCriticReview[];
}

export async function searchOpenCritic(name: string): Promise<OpenCriticGame[]> {
  const res = await fetch(
    `${BASE}/game/search?criteria=${encodeURIComponent(name)}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchOpenCriticDetail(id: number): Promise<OpenCriticDetail | null> {
  const [gameRes, reviewsRes] = await Promise.all([
    fetch(`${BASE}/game/${id}`),
    fetch(`${BASE}/review/game/${id}?skip=0&take=10`),
  ]);
  if (!gameRes.ok) return null;
  const game = await gameRes.json();
  const reviews = reviewsRes.ok ? await reviewsRes.json() : [];
  return { ...game, reviews };
}

// Find best OpenCritic match for a game name
export async function findOpenCriticGame(name: string): Promise<OpenCriticGame | null> {
  const results = await searchOpenCritic(name);
  if (!results.length) return null;
  // Return first result (usually best match)
  return results[0];
}
```

**Step 2: Commit**
```bash
git add src/lib/opencritic.ts
git commit -m "feat: add OpenCritic API client"
```

---

### Task 5: Create `useGameCatalog` hook

**Files:**
- Create: `src/hooks/useGameCatalog.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/useGameCatalog.ts
import { useQuery } from "@tanstack/react-query";
import { fetchGameList, normalisePlatforms, type RawgGame } from "@/lib/rawg";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogGame {
  id: string;           // RAWG slug
  name: string;
  coverImage: string;
  rating: number;       // 0–5
  metacriticScore: number | null;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  trending: boolean;
  description: string;
}

function mapRawgToCatalog(g: RawgGame): CatalogGame {
  return {
    id: g.slug,
    name: g.name,
    coverImage: g.background_image ?? "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80",
    rating: Math.round(g.rating * 10) / 10,
    metacriticScore: g.metacritic ?? null,
    genres: g.genres?.map((gen) => gen.slug) ?? [],
    platforms: normalisePlatforms(g.platforms),
    releaseDate: g.released ?? "TBA",
    trending: g.rating >= 4.2 && (g.metacritic ?? 0) >= 80,
    description: "",  // fetched on detail page
  };
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getCatalogGames(params: {
  search?: string;
  genre?: string;
  ordering?: string;
}): Promise<CatalogGame[]> {
  // 1. Try Supabase cache (only for unfiltered requests)
  if (!params.search && !params.genre) {
    const { data } = await supabase
      .from("games")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("rawg_rating", { ascending: false })
      .limit(40);

    if (data && data.length >= 10) {
      return data.map((g) => ({
        id: g.id,
        name: g.name,
        coverImage: g.cover_image ?? "",
        rating: g.rawg_rating ?? 0,
        metacriticScore: g.metacritic_score ?? null,
        genres: g.genres ?? [],
        platforms: g.platforms ?? [],
        releaseDate: g.release_date ?? "TBA",
        trending: g.trending ?? false,
        description: g.description ?? "",
      }));
    }
  }

  // 2. Fetch from RAWG
  const rawgGenreMap: Record<string, string> = {
    "action-rpg": "action,role-playing-games-rpg",
    fps: "shooter",
    adventure: "adventure",
    strategy: "strategy",
    horror: "action",  // RAWG doesn't have a dedicated horror genre
    racing: "racing",
    sports: "sports",
  };

  const result = await fetchGameList({
    page_size: 40,
    search: params.search,
    genres: params.genre ? rawgGenreMap[params.genre] : undefined,
    ordering: params.ordering ?? "-rating",
  });

  const games = result.results.map(mapRawgToCatalog);

  // 3. Write to Supabase cache (only unfiltered)
  if (!params.search && !params.genre && games.length > 0) {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await supabase.from("games").upsert(
      games.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.id,
        cover_image: g.coverImage,
        rawg_rating: g.rating,
        metacritic_score: g.metacriticScore,
        genres: g.genres,
        platforms: g.platforms,
        release_date: g.releaseDate,
        trending: g.trending,
        description: g.description,
        expires_at: expiresAt,
      })),
      { onConflict: "id" }
    );
  }

  return games;
}

export function useGameCatalog(params: {
  search?: string;
  genre?: string;
} = {}) {
  return useQuery({
    queryKey: ["games", "catalog", params.search, params.genre],
    queryFn: () => getCatalogGames(params),
    staleTime: 10 * 60 * 1000,  // 10 min in-memory
  });
}
```

**Step 2: Commit**
```bash
git add src/hooks/useGameCatalog.ts
git commit -m "feat: add useGameCatalog hook with RAWG + Supabase cache"
```

---

### Task 6: Create `useGameDetails` hook

**Files:**
- Create: `src/hooks/useGameDetails.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/useGameDetails.ts
import { useQuery } from "@tanstack/react-query";
import { fetchGameDetail, normalisePlatforms } from "@/lib/rawg";
import { findOpenCriticGame, fetchOpenCriticDetail } from "@/lib/opencritic";
import { supabase } from "@/integrations/supabase/client";

export interface GameDetails {
  id: string;
  name: string;
  coverImage: string;
  description: string;
  genres: string[];
  platforms: string[];
  releaseDate: string;
  developer: string;
  rawgRating: number;
  metacriticScore: number | null;
  steamAppId: number | null;
  openCritic: {
    id: number;
    score: number | null;
    percentRecommended: number | null;
    tier: string | null;
    reviews: Array<{
      outlet: string;
      outletLogo: string | null;
      author: string;
      score: number | null;
      snippet: string;
      url: string;
      publishedDate: string;
    }>;
  } | null;
}

async function getGameDetails(slug: string): Promise<GameDetails | null> {
  // 1. Fetch from RAWG
  const rawg = await fetchGameDetail(slug);

  // 2. Fetch from OpenCritic (parallel)
  const ocGame = await findOpenCriticGame(rawg.name);
  const ocDetail = ocGame ? await fetchOpenCriticDetail(ocGame.id) : null;

  // 3. Update Supabase cache
  if (ocDetail) {
    await supabase.from("games").upsert({
      id: slug,
      name: rawg.name,
      slug: rawg.slug,
      cover_image: rawg.background_image,
      rawg_rating: rawg.rating,
      metacritic_score: rawg.metacritic,
      opencritic_id: ocDetail.id,
      opencritic_score: ocDetail.topCriticScore,
      description: rawg.description_raw ?? "",
      genres: rawg.genres?.map((g) => g.slug) ?? [],
      platforms: normalisePlatforms(rawg.platforms),
      release_date: rawg.released,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "id" });
  }

  // 4. Find Steam appid from RAWG stores
  const steamStore = rawg.stores?.find((s) =>
    s.store.name.toLowerCase().includes("steam")
  );
  const steamAppId = steamStore ? null : null;  // RAWG doesn't expose appid directly

  return {
    id: rawg.slug,
    name: rawg.name,
    coverImage: rawg.background_image ?? "",
    description: rawg.description_raw ?? "",
    genres: rawg.genres?.map((g) => g.slug) ?? [],
    platforms: normalisePlatforms(rawg.platforms),
    releaseDate: rawg.released ?? "TBA",
    developer: "",  // RAWG /games/{slug} includes developers in a separate field
    rawgRating: rawg.rating,
    metacriticScore: rawg.metacritic ?? null,
    steamAppId,
    openCritic: ocDetail
      ? {
          id: ocDetail.id,
          score: ocDetail.topCriticScore,
          percentRecommended: ocDetail.percentRecommended,
          tier: ocDetail.tier,
          reviews: ocDetail.reviews.map((r) => ({
            outlet: r.outlet.name,
            outletLogo: r.outlet.imageUrl?.og ?? null,
            author: r.authors?.[0]?.name ?? "Staff",
            score: r.score,
            snippet: r.snippet,
            url: r.externalUrl,
            publishedDate: r.publishedDate,
          })),
        }
      : null,
  };
}

export function useGameDetails(slug: string | undefined) {
  return useQuery({
    queryKey: ["games", "detail", slug],
    queryFn: () => getGameDetails(slug!),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000,  // 30 min in-memory
  });
}
```

**Step 2: Commit**
```bash
git add src/hooks/useGameDetails.ts
git commit -m "feat: add useGameDetails hook with RAWG + OpenCritic"
```

---

### Task 7: Create `useGameReviews` hook

**Files:**
- Create: `src/hooks/useGameReviews.ts`

**Step 1: Create the hook**

```typescript
// src/hooks/useGameReviews.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGate } from "@/contexts/AuthGateContext";

export interface UserReview {
  id: string;
  userId: string;
  gameId: string;
  starRating: number;
  reviewText: string | null;
  tags: string[];
  helpfulVotes: number;
  createdAt: string;
  author: {
    name: string;
    avatar: string | null;
  };
}

async function fetchUserReviews(gameId: string): Promise<UserReview[]> {
  const { data, error } = await supabase
    .from("user_game_reviews")
    .select(`
      id, user_id, game_id, star_rating, review_text,
      tags, helpful_votes, created_at,
      profiles ( username, avatar_url )
    `)
    .eq("game_id", gameId)
    .order("helpful_votes", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    gameId: r.game_id,
    starRating: r.star_rating,
    reviewText: r.review_text,
    tags: r.tags ?? [],
    helpfulVotes: r.helpful_votes,
    createdAt: r.created_at,
    author: {
      name: r.profiles?.username ?? "Anonymous",
      avatar: r.profiles?.avatar_url ?? null,
    },
  }));
}

export function useUserReviews(gameId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", "user", gameId],
    queryFn: () => fetchUserReviews(gameId!),
    enabled: !!gameId,
  });
}

export function useSubmitReview(gameId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuthGate();

  return useMutation({
    mutationFn: async (payload: {
      starRating: number;
      reviewText: string;
      tags: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Ensure game exists in cache before inserting review
      await supabase.from("games").upsert(
        { id: gameId, name: gameId, slug: gameId, expires_at: new Date(Date.now() + 86400000).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );

      const { error } = await supabase.from("user_game_reviews").insert({
        user_id: user.id,
        game_id: gameId,
        star_rating: payload.starRating,
        review_text: payload.reviewText || null,
        tags: payload.tags,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] });
    },
  });
}

export function useVoteHelpful(gameId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.rpc("increment_helpful_votes", {
        review_id: reviewId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", gameId] });
    },
  });
}
```

**Step 2: Add RPC helper migration for helpful votes**

Create `supabase/migrations/20260310000002_helpful_votes_rpc.sql`:

```sql
create or replace function increment_helpful_votes(review_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.user_game_reviews
  set helpful_votes = helpful_votes + 1
  where id = review_id;
end;
$$;
```

Apply migration, then commit:
```bash
git add src/hooks/useGameReviews.ts supabase/migrations/20260310000002_helpful_votes_rpc.sql
git commit -m "feat: add useGameReviews hook with Supabase user reviews"
```

---

### Task 8: Update `GameCatalog.tsx` to use real data

**Files:**
- Modify: `src/pages/GameCatalog.tsx`

**Step 1: Replace mock import with hook**

Replace line:
```typescript
import { CATALOG_GAMES, GENRES, type CatalogGame } from "@/data/gameCatalogData";
```

With:
```typescript
import { useGameCatalog, type CatalogGame } from "@/hooks/useGameCatalog";
import { NewsCardSkeleton } from "@/components/NewsCardSkeleton";
```

**Step 2: Add GENRES constant locally (keeps UI unchanged)**

After the imports add:
```typescript
const GENRES = [
  { id: "all",        label: "All Games",    icon: "🎮" },
  { id: "action-rpg", label: "Action RPG",  icon: "⚔️" },
  { id: "fps",        label: "FPS",          icon: "🔫" },
  { id: "adventure",  label: "Adventure",    icon: "🗺️" },
  { id: "strategy",   label: "Strategy",     icon: "♟️" },
  { id: "racing",     label: "Racing",       icon: "🏎️" },
  { id: "sports",     label: "Sports",       icon: "⚽" },
];
```

**Step 3: Replace component body**

Find the main component function (starts with `export default function GameCatalog`). Replace the lines that reference `CATALOG_GAMES` and `trendingGames`:

```typescript
export default function GameCatalog() {
  const [activeGenre, setActiveGenre] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search to avoid hammering API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: games = [], isLoading, error } = useGameCatalog({
    search: debouncedSearch || undefined,
    genre: activeGenre === "all" ? undefined : activeGenre,
  });

  const trendingGames = games.filter((g) => g.trending);
  const filteredGames = games;   // hook already filters by genre/search
```

Add `useEffect` to imports at top of file.

**Step 4: Add loading + error states**

In the JSX, before the games grid, add:
```tsx
{isLoading && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-64 rounded-2xl bg-secondary animate-pulse" />
    ))}
  </div>
)}
{error && (
  <p className="text-center text-muted-foreground py-12">
    Failed to load games. Please try again.
  </p>
)}
```

**Step 5: Verify build passes**
```bash
npm run build 2>&1 | tail -5
```

**Step 6: Commit**
```bash
git add src/pages/GameCatalog.tsx
git commit -m "feat: wire GameCatalog to RAWG via useGameCatalog"
```

---

### Task 9: Update `GameReview.tsx` to use real data

**Files:**
- Modify: `src/pages/GameReview.tsx`

**Step 1: Replace mock imports**

Remove:
```typescript
import { GAME_DATABASE, TOP_REVIEWERS, type GameReview as ReviewType } from "@/data/gameReviewData";
```

Add:
```typescript
import { useGameDetails } from "@/hooks/useGameDetails";
import { useUserReviews, useSubmitReview } from "@/hooks/useGameReviews";
```

**Step 2: Replace data loading**

Find `const game = gameId ? GAME_DATABASE[gameId] : null;` and replace the data loading section:

```typescript
const { id: gameId } = useParams<{ id: string }>();

const { data: game, isLoading: gameLoading } = useGameDetails(gameId);
const { data: userReviews = [], isLoading: reviewsLoading } = useUserReviews(gameId);
const submitReview = useSubmitReview(gameId ?? "");
```

**Step 3: Add loading state guard**

Replace the `if (!game) return <Navigate to="/reviews" />;` with:
```typescript
if (gameLoading) {
  return (
    <SiteLayout>
      <div className="space-y-4 animate-pulse">
        <div className="h-64 rounded-2xl bg-secondary" />
        <div className="h-8 w-1/2 rounded bg-secondary" />
        <div className="h-4 w-full rounded bg-secondary" />
      </div>
    </SiteLayout>
  );
}
if (!game) return <Navigate to="/reviews" />;
```

**Step 4: Map critic reviews to existing ReviewCard component**

The component renders `reviewsData` — replace the mock `game.reviews` with a merged array:
```typescript
// Combine critic reviews (from OpenCritic) + user reviews for display
const criticReviews = (game.openCritic?.reviews ?? []).map((r, i) => ({
  id: `critic-${i}`,
  userName: `${r.author} — ${r.outlet}`,
  avatar: r.outletLogo ?? "https://images.unsplash.com/photo-1535303311164-664fc9ec6532?w=40&h=40&fit=crop",
  rating: r.score ? Math.round((r.score / 100) * 5) : 3,
  text: r.snippet,
  date: new Date(r.publishedDate).toLocaleDateString(),
  helpful: 0,
  notHelpful: 0,
  reviewCount: 0,
  isCritic: true,
}));
```

**Step 5: Wire submit review form to `useSubmitReview`**

Replace the existing `handleSubmitReview` function with:
```typescript
const handleSubmitReview = async () => {
  if (!userRating || !reviewText.trim()) return;
  try {
    await submitReview.mutateAsync({
      starRating: userRating,
      reviewText: reviewText.trim(),
      tags: [],
    });
    setReviewText("");
    setUserRating(0);
  } catch (e) {
    console.error("Review submit failed", e);
  }
};
```

**Step 6: Show OpenCritic score panel**

Where the page shows `averageRating` and critic score, add:
```tsx
{game.openCritic && (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
    <div className="text-center">
      <div className="text-2xl font-black text-primary">{game.openCritic.score ?? "NR"}</div>
      <div className="text-[10px] text-muted-foreground">OpenCritic</div>
    </div>
    <div>
      <div className="text-sm font-semibold">{game.openCritic.tier ?? "—"}</div>
      <div className="text-xs text-muted-foreground">
        {game.openCritic.percentRecommended?.toFixed(0)}% recommend
      </div>
    </div>
  </div>
)}
```

**Step 7: Verify build passes**
```bash
npm run build 2>&1 | tail -5
```

**Step 8: Commit**
```bash
git add src/pages/GameReview.tsx
git commit -m "feat: wire GameReview to RAWG + OpenCritic + Supabase reviews"
```

---

### Task 10: Update `Esports.tsx` to use real PandaScore data

**Files:**
- Modify: `src/pages/Esports.tsx`

**Step 1: Replace mock import**

Remove:
```typescript
import { GAME_FILTERS, ESPORTS_MATCHES, type EsportsMatch, type EsportsTeam } from "@/data/esportsData";
```

Add:
```typescript
import { GAME_FILTERS } from "@/data/esportsData";   // keep static filter list
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
import type { EsportsMatch } from "@/lib/pandascore";
```

**Step 2: Replace data usage in component**

Find where the component uses `ESPORTS_MATCHES` and replace with the hook:

```typescript
const { liveMatches, upcomingMatches, pastMatches, isLoading, error } = useEsportsMatches();

// Combine for filtering
const allMatches: EsportsMatch[] = [...liveMatches, ...upcomingMatches, ...pastMatches];

// Filter by selected game
const filteredMatches = activeGame === "all"
  ? allMatches
  : allMatches.filter((m) =>
      m.game.toLowerCase().includes(activeGame) ||
      m.gameLabel.toLowerCase().includes(activeGame)
    );
```

**Step 3: Add loading/error states in JSX**

Replace the matches grid with:
```tsx
{isLoading && (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-24 rounded-xl bg-secondary animate-pulse" />
    ))}
  </div>
)}
{error && (
  <p className="text-muted-foreground text-center py-8">
    Could not load matches. PandaScore may be rate-limited.
  </p>
)}
{!isLoading && !error && filteredMatches.map((match) => (
  // existing MatchCard component
))}
```

**Step 4: Adapt MatchCard to `EsportsMatch` from `pandascore.ts`**

The PandaScore `EsportsMatch` has: `team1`, `team2`, `score1`, `score2`, `game`, `gameLabel`, `tournament`, `status`, `begin_at`, `streamUrl`.

Map these to the existing MatchCard display — update field names in the JSX.

**Step 5: Verify build passes**
```bash
npm run build 2>&1 | tail -5
```

**Step 6: Commit**
```bash
git add src/pages/Esports.tsx
git commit -m "feat: wire Esports page to live PandaScore data"
```

---

### Task 11: Update `RightSidebar.tsx` to use live esports data

**Files:**
- Modify: `src/components/RightSidebar.tsx`

**Step 1: Replace mock imports**

Remove:
```typescript
import { FRIENDS_ONLINE, LIVE_MATCH } from "@/data/mockNews";
import { ESPORTS_MATCHES } from "@/data/esportsData";
```

Add:
```typescript
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
```

**Step 2: Replace state/effect with hook**

Remove the `useState<typeof ESPORTS_MATCHES>` and `useEffect` that filters upcoming matches.

Add:
```typescript
const { liveMatches, upcomingMatches, isLoading } = useEsportsMatches();
const liveMatch = liveMatches[0] ?? null;
const showUpcoming = upcomingMatches.slice(0, 2);
```

**Step 3: Replace LIVE_MATCH usage**

Replace all `LIVE_MATCH.xxx` references:
```tsx
{liveMatch ? (
  <div>
    <p className="text-xs text-muted-foreground">{liveMatch.tournament}</p>
    <h4 className="font-bold text-lg mb-2">{liveMatch.team1} vs {liveMatch.team2}</h4>
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span>LIVE — {liveMatch.score1} : {liveMatch.score2}</span>
    </div>
    {liveMatch.streamUrl && (
      <a href={liveMatch.streamUrl} target="_blank" rel="noopener noreferrer">
        <Button size="sm" className="w-full">Watch Live</Button>
      </a>
    )}
  </div>
) : (
  <p className="text-sm text-muted-foreground">No live matches right now</p>
)}
```

**Step 4: Replace PredictionCard matches**

Replace `upcomingMatches` (from ESPORTS_MATCHES) with `showUpcoming` from the hook. The `PredictionCard` expects a match with `id`, `teamA`, `teamB`, `format`, etc. — adapt the mapping to use `EsportsMatch` fields (`team1`, `team2`, `id`, `numberOfGames`).

**Step 5: Remove FRIENDS_ONLINE usage**

The `FRIENDS_ONLINE` mock shows online friends — since there's no real friends system yet, replace with a "Coming Soon" stub:
```tsx
<p className="text-sm text-muted-foreground text-center py-2">
  Friends activity coming soon
</p>
```

**Step 6: Verify build passes**
```bash
npm run build 2>&1 | tail -5
```

**Step 7: Commit**
```bash
git add src/components/RightSidebar.tsx
git commit -m "feat: wire RightSidebar to live PandaScore esports data"
```

---

### Task 12: Update `UserProfileCard.tsx` to use real auth

**Files:**
- Modify: `src/components/UserProfileCard.tsx`

**Step 1: Replace mock user with Supabase auth**

Remove the hardcoded `MOCK_USER` constant. Replace with:
```typescript
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Profile {
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
}

export function UserProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setIsLoggedIn(true);
      supabase
        .from("profiles")
        .select("username, avatar_url, banner_url, bio")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setProfile(data));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);
```

**Step 2: Render guest state when not logged in**

```tsx
if (!isLoggedIn) {
  return (
    <div className="bg-card rounded-2xl border p-4 card-shadow text-center space-y-3">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl mx-auto">
        🎮
      </div>
      <p className="text-sm text-muted-foreground">Sign in to track your XP and stats</p>
      <Link to="/login">
        <Button className="w-full" size="sm">Sign In</Button>
      </Link>
    </div>
  );
}
```

**Step 3: Keep existing animated card design, swap mock data for real data**

Replace `MOCK_USER.displayName` → `profile?.username ?? "Gamer"`, `MOCK_USER.avatar_url` → `profile?.avatar_url`, `MOCK_USER.bio` → `profile?.bio ?? ""`, etc. Keep the `motion.div` structure intact.

**Step 4: Verify build passes**
```bash
npm run build 2>&1 | tail -5
```

**Step 5: Commit**
```bash
git add src/components/UserProfileCard.tsx
git commit -m "feat: wire UserProfileCard to real Supabase auth + profile"
```

---

### Task 13: Final push and smoke test

**Step 1: Full build check**
```bash
npm run build 2>&1 | grep -E "error|warning|built"
```
Expected: `✓ built in Xs` with no TypeScript errors.

**Step 2: Run existing tests**
```bash
npm run test 2>&1 | tail -20
```

**Step 3: Push to GitHub (triggers CI deploy)**
```bash
git push origin main
```

**Step 4: Smoke test on staging (GitHub Pages)**
- [ ] Game Catalog loads real games from RAWG
- [ ] Clicking a game loads real detail + OpenCritic score
- [ ] Esports page shows live/upcoming PandaScore matches
- [ ] Right sidebar live match widget uses real PandaScore data
- [ ] UserProfileCard shows guest state when not logged in
- [ ] Logged-in user sees real profile data

---
