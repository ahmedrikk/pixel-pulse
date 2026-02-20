# Esports API Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded mock esports data with live PandaScore API data (live scores + upcoming matches in RightSidebar, esports articles in main news feed).

**Architecture:** A new `src/lib/pandascore.ts` module handles all PandaScore API types and data transformation. A new `useEsportsScores` hook uses React Query for auto-polling live/upcoming matches every 60s. The existing `useGamingNews` hook is extended to fetch PandaScore articles and merge them into the main feed.

**Tech Stack:** React Query (`@tanstack/react-query` already installed), Vitest + jsdom for tests, PandaScore REST API (Bearer token auth), TypeScript

---

## Task 1: Add API key to .env

**Files:**
- Modify: `pixel-pulse/.env`

**Step 1: Add the PandaScore key**

Append this line to `.env`:
```
VITE_PANDASCORE_API_KEY=UmKsigJWUYbNSIOTA6sgdb8RL84E57ays_wrc1e4aROnVVzY_Ts
```

**Step 2: Verify .env now has three keys**

Open `.env` and confirm it reads:
```
VITE_SUPABASE_PROJECT_ID="..."
VITE_SUPABASE_PUBLISHABLE_KEY="..."
VITE_SUPABASE_URL="..."
VITE_PANDASCORE_API_KEY=UmKsigJWUYbNSIOTA6sgdb8RL84E57ays_wrc1e4aROnVVzY_Ts
```

**Step 3: Commit**
```bash
cd pixel-pulse
git add .env
git commit -m "chore: add PandaScore API key to env"
```

---

## Task 2: Create PandaScore API client + types

**Files:**
- Create: `pixel-pulse/src/lib/pandascore.ts`
- Create: `pixel-pulse/src/lib/pandascore.test.ts`

**Step 1: Write the failing tests first**

Create `pixel-pulse/src/lib/pandascore.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  transformMatch,
  transformArticle,
  getGameLabel,
  formatMatchScore,
  type PandaScoreMatch,
  type PandaScoreArticle,
} from "./pandascore";

const mockMatch: PandaScoreMatch = {
  id: 1,
  name: "FaZe vs NaVi",
  status: "running",
  begin_at: "2026-02-20T15:00:00Z",
  videogame: { name: "Counter-Strike 2", slug: "cs-go" },
  tournament: { name: "ESL Pro League" },
  league: { name: "ESL" },
  opponents: [
    { opponent: { name: "FaZe Clan", image_url: "https://example.com/faze.png" } },
    { opponent: { name: "NaVi", image_url: "https://example.com/navi.png" } },
  ],
  results: [
    { score: 2, team_id: 10 },
    { score: 1, team_id: 11 },
  ],
  streams_list: [
    { raw_url: "https://twitch.tv/esl_csgo", main: true, language: "en" },
  ],
};

const mockArticle: PandaScoreArticle = {
  id: 42,
  title: "CS2 Major Recap",
  description: "A great tournament happened.",
  slug: "cs2-major-recap",
  published_at: "2026-02-20T10:00:00Z",
  thumbnail: { url: "https://example.com/thumb.jpg" },
  videogames: [{ name: "Counter-Strike 2" }],
};

describe("transformMatch", () => {
  it("extracts team names correctly", () => {
    const result = transformMatch(mockMatch);
    expect(result.team1).toBe("FaZe Clan");
    expect(result.team2).toBe("NaVi");
  });

  it("extracts scores correctly", () => {
    const result = transformMatch(mockMatch);
    expect(result.score1).toBe(2);
    expect(result.score2).toBe(1);
  });

  it("extracts main stream url", () => {
    const result = transformMatch(mockMatch);
    expect(result.streamUrl).toBe("https://twitch.tv/esl_csgo");
  });

  it("returns null streamUrl when no streams", () => {
    const noStreams = { ...mockMatch, streams_list: [] };
    const result = transformMatch(noStreams);
    expect(result.streamUrl).toBeNull();
  });

  it("includes game and tournament names", () => {
    const result = transformMatch(mockMatch);
    expect(result.game).toBe("Counter-Strike 2");
    expect(result.tournament).toBe("ESL Pro League");
  });
});

describe("transformArticle", () => {
  it("maps to NewsItem shape", () => {
    const result = transformArticle(mockArticle);
    expect(result.title).toBe("CS2 Major Recap");
    expect(result.summary).toBe("A great tournament happened.");
    expect(result.source).toBe("PandaScore");
    expect(result.category).toBe("Esports");
    expect(result.tags).toContain("Esports");
  });

  it("uses thumbnail url as imageUrl", () => {
    const result = transformArticle(mockArticle);
    expect(result.imageUrl).toBe("https://example.com/thumb.jpg");
  });

  it("falls back to placeholder image when no thumbnail", () => {
    const noThumb = { ...mockArticle, thumbnail: undefined };
    const result = transformArticle(noThumb);
    expect(result.imageUrl).toContain("unsplash.com");
  });
});

describe("getGameLabel", () => {
  it("shortens Counter-Strike 2", () => {
    expect(getGameLabel("Counter-Strike 2")).toBe("CS2");
  });
  it("shortens League of Legends", () => {
    expect(getGameLabel("League of Legends")).toBe("LoL");
  });
  it("returns original for unknown games", () => {
    expect(getGameLabel("Rocket League")).toBe("Rocket League");
  });
});

describe("formatMatchScore", () => {
  it("formats scores as string", () => {
    expect(formatMatchScore(2, 1)).toBe("2 - 1");
  });
  it("formats zeros", () => {
    expect(formatMatchScore(0, 0)).toBe("0 - 0");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd pixel-pulse
npm run test -- src/lib/pandascore.test.ts
```
Expected: FAIL — "Cannot find module './pandascore'"

**Step 3: Create `src/lib/pandascore.ts`**

```typescript
import { NewsItem } from "@/data/mockNews";

const BASE_URL = "https://api.pandascore.co";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=400&fit=crop";

// --- Types ---

export interface PandaScoreMatch {
  id: number;
  name: string;
  status: "running" | "not_started" | "finished";
  begin_at: string;
  videogame: { name: string; slug: string };
  tournament: { name: string };
  league: { name: string };
  opponents: Array<{ opponent: { name: string; image_url: string | null } }>;
  results: Array<{ score: number; team_id: number }>;
  streams_list: Array<{ raw_url: string; main: boolean; language: string }>;
}

export interface PandaScoreArticle {
  id: number;
  title: string;
  description: string;
  slug: string;
  published_at: string;
  thumbnail?: { url: string };
  videogames: Array<{ name: string }>;
}

export interface EsportsMatch {
  id: number;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  game: string;
  gameLabel: string;
  tournament: string;
  status: "running" | "not_started";
  begin_at: string;
  streamUrl: string | null;
}

// --- Helpers ---

const GAME_LABELS: Record<string, string> = {
  "Counter-Strike 2": "CS2",
  "League of Legends": "LoL",
  "Dota 2": "Dota 2",
  Valorant: "Valorant",
  Overwatch: "OW2",
  "Rocket League": "RL",
  "Rainbow Six Siege": "R6",
  "PUBG Mobile": "PUBG",
};

export function getGameLabel(gameName: string): string {
  return GAME_LABELS[gameName] ?? gameName;
}

export function formatMatchScore(score1: number, score2: number): string {
  return `${score1} - ${score2}`;
}

// --- Transformers ---

export function transformMatch(match: PandaScoreMatch): EsportsMatch {
  const team1 = match.opponents[0]?.opponent.name ?? "TBD";
  const team2 = match.opponents[1]?.opponent.name ?? "TBD";
  const score1 = match.results[0]?.score ?? 0;
  const score2 = match.results[1]?.score ?? 0;
  const mainStream =
    match.streams_list.find((s) => s.main && s.language === "en") ??
    match.streams_list.find((s) => s.main) ??
    null;

  return {
    id: match.id,
    team1,
    team2,
    score1,
    score2,
    game: match.videogame.name,
    gameLabel: getGameLabel(match.videogame.name),
    tournament: match.tournament.name,
    status: match.status as "running" | "not_started",
    begin_at: match.begin_at,
    streamUrl: mainStream?.raw_url ?? null,
  };
}

export function transformArticle(article: PandaScoreArticle): NewsItem {
  const gameNames = article.videogames.map((v) => v.name);
  const gameTags = gameNames.map(getGameLabel).filter(Boolean);

  return {
    id: `pandascore-${article.id}`,
    title: article.title,
    summary: article.description || "Read the full article for more details.",
    sourceUrl: `https://pandascore.co/news/${article.slug}`,
    imageUrl: article.thumbnail?.url ?? FALLBACK_IMAGE,
    category: "Esports",
    timestamp: article.published_at,
    source: "PandaScore",
    author: "PandaScore Staff",
    tags: Array.from(new Set(["Esports", "Gaming", ...gameTags])).slice(0, 6),
    likes: Math.floor(Math.random() * 200) + 20,
  };
}

// --- API fetchers ---

function getHeaders(): HeadersInit {
  const key = import.meta.env.VITE_PANDASCORE_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function fetchLiveMatches(): Promise<EsportsMatch[]> {
  const res = await fetch(`${BASE_URL}/matches/running?page[size]=5`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`PandaScore error: ${res.status}`);
  const data: PandaScoreMatch[] = await res.json();
  return data
    .filter((m) => m.opponents.length >= 2)
    .map(transformMatch);
}

export async function fetchUpcomingMatches(): Promise<EsportsMatch[]> {
  const res = await fetch(
    `${BASE_URL}/matches/upcoming?sort=begin_at&page[size]=5`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`PandaScore error: ${res.status}`);
  const data: PandaScoreMatch[] = await res.json();
  return data
    .filter((m) => m.opponents.length >= 2)
    .map(transformMatch);
}

export async function fetchEsportsArticles(): Promise<NewsItem[]> {
  const res = await fetch(
    `${BASE_URL}/articles?sort=-published_at&page[size]=10`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`PandaScore articles error: ${res.status}`);
  const data: PandaScoreArticle[] = await res.json();
  return data.map(transformArticle);
}
```

**Step 4: Run tests to verify they pass**

```bash
cd pixel-pulse
npm run test -- src/lib/pandascore.test.ts
```
Expected: All tests PASS

**Step 5: Commit**
```bash
git add src/lib/pandascore.ts src/lib/pandascore.test.ts
git commit -m "feat: add PandaScore API client with types and transformers"
```

---

## Task 3: Create useEsportsScores hook

**Files:**
- Create: `pixel-pulse/src/hooks/useEsportsScores.ts`

**Step 1: Create the hook**

Create `pixel-pulse/src/hooks/useEsportsScores.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchLiveMatches, fetchUpcomingMatches, type EsportsMatch } from "@/lib/pandascore";

export function useEsportsScores() {
  const liveQuery = useQuery<EsportsMatch[]>({
    queryKey: ["esports-live"],
    queryFn: fetchLiveMatches,
    refetchInterval: 60_000,      // poll every 60 seconds
    staleTime: 30_000,
    retry: 2,
  });

  const upcomingQuery = useQuery<EsportsMatch[]>({
    queryKey: ["esports-upcoming"],
    queryFn: fetchUpcomingMatches,
    refetchInterval: 5 * 60_000,  // poll every 5 minutes
    staleTime: 2 * 60_000,
    retry: 2,
  });

  return {
    liveMatches: liveQuery.data ?? [],
    upcomingMatches: upcomingQuery.data ?? [],
    isLiveLoading: liveQuery.isLoading,
    isUpcomingLoading: upcomingQuery.isLoading,
    liveError: liveQuery.error,
    upcomingError: upcomingQuery.error,
  };
}
```

**Step 2: Verify the file is importable (run existing tests, no regressions)**

```bash
cd pixel-pulse
npm run test
```
Expected: All existing tests still PASS

**Step 3: Commit**
```bash
git add src/hooks/useEsportsScores.ts
git commit -m "feat: add useEsportsScores hook with React Query polling"
```

---

## Task 4: Update RightSidebar with live data

**Files:**
- Modify: `pixel-pulse/src/components/RightSidebar.tsx`

**Step 1: Replace RightSidebar.tsx content**

Replace the entire file with:
```typescript
import { useState } from "react";
import { Zap, Users, HelpCircle, ExternalLink, Radio, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRIENDS_ONLINE, TRIVIA_QUESTION } from "@/data/mockNews";
import { useEsportsScores } from "@/hooks/useEsportsScores";
import { formatMatchScore } from "@/lib/pandascore";
import { formatDistanceToNow } from "date-fns";

const GAME_COLORS: Record<string, string> = {
  CS2: "bg-yellow-500/20 text-yellow-400",
  LoL: "bg-blue-500/20 text-blue-400",
  Valorant: "bg-red-500/20 text-red-400",
  "Dota 2": "bg-purple-500/20 text-purple-400",
  OW2: "bg-orange-500/20 text-orange-400",
  R6: "bg-green-500/20 text-green-400",
};

function GameBadge({ label }: { label: string }) {
  const color = GAME_COLORS[label] ?? "bg-primary/20 text-primary";
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>
      {label}
    </span>
  );
}

function LiveMatchesSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-2 animate-pulse">
          <div className="h-3 bg-secondary rounded w-1/3" />
          <div className="h-4 bg-secondary rounded w-3/4" />
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { liveMatches, upcomingMatches, isLiveLoading, isUpcomingLoading } =
    useEsportsScores();

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowResult(true);
  };

  const displayedLive = liveMatches.slice(0, 3);
  const displayedUpcoming = upcomingMatches.slice(0, 3);

  return (
    <aside className="w-full lg:w-72 space-y-4">

      {/* Live Matches Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-destructive/20 to-primary/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive animate-pulse" />
            <h3 className="font-semibold">Live Matches</h3>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
              <span className="px-2 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full font-medium">
                LIVE
              </span>
            </span>
          </div>
        </div>

        {isLiveLoading ? (
          <LiveMatchesSkeleton />
        ) : displayedLive.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No live matches right now
          </div>
        ) : (
          <div className="divide-y">
            {displayedLive.map((match) => (
              <div key={match.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GameBadge label={match.gameLabel} />
                  <span className="text-xs text-muted-foreground truncate">
                    {match.tournament}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium truncate flex-1">
                    {match.team1}
                  </span>
                  <span className="text-sm font-bold text-primary shrink-0 px-2">
                    {formatMatchScore(match.score1, match.score2)}
                  </span>
                  <span className="text-sm font-medium truncate flex-1 text-right">
                    {match.team2}
                  </span>
                </div>
                {match.streamUrl && (
                  <Button asChild size="sm" className="w-full gap-2 h-7 text-xs">
                    <a
                      href={match.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Watch Live
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Matches Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            <h3 className="font-semibold">Upcoming</h3>
          </div>
        </div>

        {isUpcomingLoading ? (
          <LiveMatchesSkeleton />
        ) : displayedUpcoming.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No upcoming matches scheduled
          </div>
        ) : (
          <div className="divide-y">
            {displayedUpcoming.map((match) => (
              <div key={match.id} className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <GameBadge label={match.gameLabel} />
                  <span className="text-xs text-muted-foreground truncate">
                    {match.tournament}
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {match.team1} vs {match.team2}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {match.begin_at
                    ? `Starts ${formatDistanceToNow(new Date(match.begin_at), { addSuffix: true })}`
                    : "Time TBD"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends Online */}
      <div className="bg-card rounded-lg border p-4 card-shadow">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Friends Online
        </h3>
        <div className="space-y-3">
          {FRIENDS_ONLINE.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                  {friend.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    friend.status === "online"
                      ? "bg-online"
                      : friend.status === "away"
                      ? "bg-yellow-500"
                      : "bg-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{friend.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {friend.game}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gaming Trivia */}
      <div className="bg-card rounded-lg border p-4 card-shadow">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-accent" />
          Daily Trivia
        </h3>
        <p className="text-sm mb-4">{TRIVIA_QUESTION.question}</p>
        <div className="space-y-2">
          {TRIVIA_QUESTION.options.map((option, index) => {
            const isCorrect = index === TRIVIA_QUESTION.correctAnswer;
            const isSelected = selectedAnswer === index;
            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  showResult
                    ? isCorrect
                      ? "bg-online/20 text-online border border-online"
                      : isSelected
                      ? "bg-destructive/20 text-destructive border border-destructive"
                      : "bg-secondary text-muted-foreground"
                    : "bg-secondary hover:bg-tag hover:text-tag-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {showResult && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {selectedAnswer === TRIVIA_QUESTION.correctAnswer
              ? "🎉 Correct! +10 XP"
              : "❌ Nice try! Check back tomorrow."}
          </p>
        )}
      </div>
    </aside>
  );
}
```

**Step 2: Run dev server and verify sidebar renders**

```bash
cd pixel-pulse
npm run dev
```
Open http://localhost:8080 — the right sidebar should show:
- "Live Matches" widget with loading skeleton, then real matches (or "No live matches right now")
- "Upcoming" widget with real upcoming match data
- Friends Online and Trivia unchanged

**Step 3: Commit**
```bash
git add src/components/RightSidebar.tsx
git commit -m "feat: replace static sidebar widgets with live PandaScore data"
```

---

## Task 5: Add PandaScore articles to main news feed

**Files:**
- Modify: `pixel-pulse/src/hooks/useGamingNews.ts`

**Step 1: Add PandaScore article fetch to useGamingNews**

In `useGamingNews.ts`, make these two targeted changes:

**Change A** — add the import at the top (after the existing imports):
```typescript
import { fetchEsportsArticles } from "@/lib/pandascore";
```

**Change B** — inside `fetchAllFeeds`, after `allNews.sort(...)` and before `if (enableAI)`, add:
```typescript
      // Fetch PandaScore esports articles and merge in
      try {
        const esportsArticles = await fetchEsportsArticles();
        allNews = [...allNews, ...esportsArticles];
        // Re-sort after merge
        allNews.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      } catch (err) {
        console.warn("PandaScore articles unavailable:", err);
        // Non-fatal: RSS articles still display
      }
```

The exact insertion point is after this existing line:
```typescript
      allNews.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
```
...and before:
```typescript
      // Process with AI if enabled
      if (enableAI) {
```

**Step 2: Run tests to verify no regressions**
```bash
cd pixel-pulse
npm run test
```
Expected: All tests PASS

**Step 3: Check in browser**

Refresh http://localhost:8080 — the main feed should now include articles with `source: "PandaScore"` mixed in among the RSS articles, tagged as Esports.

**Step 4: Commit**
```bash
git add src/hooks/useGamingNews.ts
git commit -m "feat: merge PandaScore esports articles into main news feed"
```

---

## Task 6: Start dev server (persistent)

**Step 1: Start in background**

```bash
cd pixel-pulse
npm run dev
```

Server runs at http://localhost:8080 with HMR — all subsequent file changes will hot-reload instantly in the browser.

---

## Summary of Changes

| File | Change |
|------|--------|
| `.env` | Added `VITE_PANDASCORE_API_KEY` |
| `src/lib/pandascore.ts` | New: types, transformers, API fetchers |
| `src/lib/pandascore.test.ts` | New: unit tests for transformers |
| `src/hooks/useEsportsScores.ts` | New: React Query hook for live + upcoming |
| `src/components/RightSidebar.tsx` | Replaced static widgets with live data |
| `src/hooks/useGamingNews.ts` | Added PandaScore articles merge |
