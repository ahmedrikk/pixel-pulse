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
