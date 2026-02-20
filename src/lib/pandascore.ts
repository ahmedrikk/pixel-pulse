const BASE_URL = "https://api.pandascore.co";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=400&fit=crop";

// --- Types ---

export interface PandaScoreMatch {
  id: number;
  name: string;
  status: "running" | "not_started" | "finished";
  begin_at: string | null;
  videogame: { name: string; slug: string };
  tournament: { name: string };
  league: { name: string };
  opponents: Array<{ opponent: { id: number; name: string; image_url: string | null } }>;
  results: Array<{ score: number; team_id: number }>;
  streams_list: Array<{ raw_url: string; main: boolean; language: string }>;
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
  status: "running" | "not_started" | "finished";
  begin_at: string | null;
  streamUrl: string | null;
}

// --- Helpers ---

const GAME_LABELS: Record<string, string> = {
  "Counter-Strike 2": "CS2",
  "League of Legends": "LoL",
  "Dota 2": "Dota 2",
  Valorant: "Valorant",
  Overwatch: "OW2",
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
  const team1Id = match.opponents[0]?.opponent.id;
  const team2Id = match.opponents[1]?.opponent.id;
  const score1 = match.results.find((r) => r.team_id === team1Id)?.score ?? 0;
  const score2 = match.results.find((r) => r.team_id === team2Id)?.score ?? 0;
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
    status: match.status,
    begin_at: match.begin_at,
    streamUrl: mainStream?.raw_url ?? null,
  };
}

// --- API fetchers ---

function getHeaders(): HeadersInit {
  const key = import.meta.env.VITE_PANDASCORE_API_KEY;
  if (!key) throw new Error("VITE_PANDASCORE_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
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

