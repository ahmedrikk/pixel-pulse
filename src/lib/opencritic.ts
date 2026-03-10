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
