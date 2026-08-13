// src/lib/rawg.ts
const BASE = "/api/rawg";

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  background_image: string | null;
  rating: number;           // 0–5
  ratings_count?: number;
  added?: number;           // how many RAWG users added the game — popularity proxy
  metacritic: number | null;
  released: string | null;
  genres: { id: number; slug: string; name: string }[];
  platforms: { platform: { name: string } }[] | null;
  description_raw?: string;
  stores?: { store: { name: string } }[] | null;
  developers?: { id: number; name: string; slug: string }[];
  publishers?: { id: number; name: string; slug: string }[];
}

export interface RawgListResponse {
  count: number;
  results: RawgGame[];
}

function rawgUrl(path: string, params: Record<string, string | number> = {}): string {
  const url = new URL(BASE, window.location.origin);
  const detailMatch = path.match(/^\/games\/([a-z0-9-]+)$/i);
  if (detailMatch) url.searchParams.set("slug", detailMatch[1]);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export async function fetchGameList(
  params: {
    page?: number;
    page_size?: number;
    search?: string;
    genres?: string;       // comma-separated RAWG genre slugs
    ordering?: string;     // e.g. "-rating", "-metacritic", "-added"
    dates?: string;        // inclusive YYYY-MM-DD,YYYY-MM-DD release window
  } = {},
  signal?: AbortSignal
): Promise<RawgListResponse> {
  const res = await fetch(
    rawgUrl("/games", {
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
      ...(params.search && { search: params.search }),
      ...(params.genres && { genres: params.genres }),
      ...(params.dates && { dates: params.dates }),
      // When searching, let RAWG rank by relevance — forcing "-rating"
      // returns the highest-rated fuzzy match instead of the right game.
      ...(params.search
        ? (params.ordering ? { ordering: params.ordering } : {})
        : { ordering: params.ordering ?? "-rating" }),
    }),
    { signal }
  );
  if (!res.ok) throw new Error(`Game catalog request failed: ${res.status}`);
  return res.json();
}

export async function fetchGameDetail(
  slug: string,
  signal?: AbortSignal
): Promise<RawgGame> {
  const res = await fetch(rawgUrl(`/games/${slug}`), { signal });
  if (!res.ok) throw new Error(`Game detail request failed: ${res.status}`);
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
