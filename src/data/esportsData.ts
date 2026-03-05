export interface EsportsTeam {
  name: string;
  logo: string; // emoji fallback
  shortName: string;
}

export interface EsportsMatch {
  id: string;
  gameTitle: string;
  leagueName: string;
  format: string;
  teamA: EsportsTeam;
  teamB: EsportsTeam;
  scoreA: number | null;
  scoreB: number | null;
  timestamp: string;
  status: "live" | "upcoming" | "completed";
}

export const GAME_FILTERS = [
  { id: "all", label: "All Games", icon: "🎮" },
  { id: "valorant", label: "Valorant", icon: "🔫" },
  { id: "cs2", label: "CS2", icon: "💣" },
  { id: "lol", label: "League of Legends", icon: "⚔️" },
  { id: "dota2", label: "Dota 2", icon: "🛡️" },
  { id: "overwatch", label: "Overwatch 2", icon: "🦸" },
  { id: "r6", label: "Rainbow Six", icon: "🔒" },
];

export const ESPORTS_MATCHES: EsportsMatch[] = [
  // Live matches
  {
    id: "live-1",
    gameTitle: "valorant",
    leagueName: "VCT Americas 2026 — Stage 1",
    format: "Bo3",
    teamA: { name: "Sentinels", logo: "🔴", shortName: "SEN" },
    teamB: { name: "Fnatic", logo: "🟠", shortName: "FNC" },
    scoreA: 1,
    scoreB: 1,
    timestamp: "2026-03-05T18:00:00Z",
    status: "live",
  },
  {
    id: "live-2",
    gameTitle: "cs2",
    leagueName: "IEM Katowice 2026 — Grand Final",
    format: "Bo5",
    teamA: { name: "Natus Vincere", logo: "🟡", shortName: "NAVI" },
    teamB: { name: "FaZe Clan", logo: "🔴", shortName: "FaZe" },
    scoreA: 2,
    scoreB: 1,
    timestamp: "2026-03-05T16:00:00Z",
    status: "live",
  },
  {
    id: "live-3",
    gameTitle: "lol",
    leagueName: "LCK Spring 2026 — Playoffs",
    format: "Bo5",
    teamA: { name: "T1", logo: "🔴", shortName: "T1" },
    teamB: { name: "Gen.G", logo: "🟡", shortName: "GEN" },
    scoreA: 2,
    scoreB: 2,
    timestamp: "2026-03-05T10:00:00Z",
    status: "live",
  },

  // Upcoming matches — March 6 (tomorrow)
  {
    id: "upcoming-1",
    gameTitle: "valorant",
    leagueName: "VCT EMEA 2026 — Stage 1",
    format: "Bo3",
    teamA: { name: "Team Vitality", logo: "🐝", shortName: "VIT" },
    teamB: { name: "Team Heretics", logo: "🟣", shortName: "TH" },
    scoreA: null,
    scoreB: null,
    timestamp: "2026-03-06T14:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-2",
    gameTitle: "dota2",
    leagueName: "DreamLeague Season 23",
    format: "Bo3",
    teamA: { name: "Team Spirit", logo: "🐉", shortName: "TS" },
    teamB: { name: "Tundra Esports", logo: "🧊", shortName: "TUN" },
    scoreA: null,
    scoreB: null,
    timestamp: "2026-03-06T16:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-3",
    gameTitle: "overwatch",
    leagueName: "Overwatch Champions Series 2026",
    format: "Bo5",
    teamA: { name: "San Francisco Shock", logo: "⚡", shortName: "SFS" },
    teamB: { name: "Seoul Dynasty", logo: "🐯", shortName: "SEO" },
    scoreA: null,
    scoreB: null,
    timestamp: "2026-03-06T09:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-4",
    gameTitle: "cs2",
    leagueName: "BLAST Premier Spring 2026",
    format: "Bo3",
    teamA: { name: "Vitality", logo: "🐝", shortName: "VIT" },
    teamB: { name: "G2 Esports", logo: "⬛", shortName: "G2" },
    scoreA: null,
    scoreB: null,
    timestamp: "2026-03-06T19:00:00Z",
    status: "upcoming",
  },

  // Upcoming — March 7
  {
    id: "upcoming-5",
    gameTitle: "lol",
    leagueName: "LEC Winter 2026 — Week 8",
    format: "Bo3",
    teamA: { name: "G2 Esports", logo: "⬛", shortName: "G2" },
    teamB: { name: "Fnatic", logo: "🟠", shortName: "FNC" },
    scoreA: null,
    scoreB: null,
    timestamp: "2026-03-07T17:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-6",
    gameTitle: "r6",
    leagueName: "Six Invitational 2026",
    format: "Bo3",
    teamA: { name: "Team BDS", logo: "🔵", shortName: "BDS" },
    teamB: { name: "w7m esports", logo: "🟢", shortName: "W7M" },
    scoreA: null,
    scoreB: null,
    timestamp: "2026-03-07T20:00:00Z",
    status: "upcoming",
  },

  // Completed — March 4 (yesterday)
  {
    id: "past-1",
    gameTitle: "cs2",
    leagueName: "IEM Katowice 2026 — Semifinal",
    format: "Bo3",
    teamA: { name: "Natus Vincere", logo: "🟡", shortName: "NAVI" },
    teamB: { name: "Team Liquid", logo: "🔵", shortName: "TL" },
    scoreA: 2,
    scoreB: 0,
    timestamp: "2026-03-04T15:00:00Z",
    status: "completed",
  },
  {
    id: "past-2",
    gameTitle: "valorant",
    leagueName: "VCT Pacific 2026 — Stage 1",
    format: "Bo3",
    teamA: { name: "DRX", logo: "🐲", shortName: "DRX" },
    teamB: { name: "Paper Rex", logo: "📄", shortName: "PRX" },
    scoreA: 1,
    scoreB: 2,
    timestamp: "2026-03-04T11:00:00Z",
    status: "completed",
  },
  {
    id: "past-3",
    gameTitle: "lol",
    leagueName: "LCK Spring 2026 — Week 7",
    format: "Bo3",
    teamA: { name: "Hanwha Life", logo: "🟢", shortName: "HLE" },
    teamB: { name: "DK", logo: "🔵", shortName: "DK" },
    scoreA: 2,
    scoreB: 1,
    timestamp: "2026-03-04T08:00:00Z",
    status: "completed",
  },

  // Completed — March 3
  {
    id: "past-4",
    gameTitle: "dota2",
    leagueName: "DreamLeague Season 23 — Group Stage",
    format: "Bo3",
    teamA: { name: "Team Falcons", logo: "🦅", shortName: "FAL" },
    teamB: { name: "Gaimin Gladiators", logo: "⚔️", shortName: "GG" },
    scoreA: 2,
    scoreB: 1,
    timestamp: "2026-03-03T14:00:00Z",
    status: "completed",
  },
  {
    id: "past-5",
    gameTitle: "overwatch",
    leagueName: "Overwatch Champions Series 2026",
    format: "Bo5",
    teamA: { name: "Toronto Defiant", logo: "⬛", shortName: "TOR" },
    teamB: { name: "London Spitfire", logo: "🔵", shortName: "LDN" },
    scoreA: 3,
    scoreB: 1,
    timestamp: "2026-03-03T18:00:00Z",
    status: "completed",
  },
  {
    id: "past-6",
    gameTitle: "r6",
    leagueName: "Six Invitational 2026 — Group Stage",
    format: "Bo3",
    teamA: { name: "Team Secret", logo: "🃏", shortName: "SEC" },
    teamB: { name: "FaZe Clan", logo: "🔴", shortName: "FaZe" },
    scoreA: 0,
    scoreB: 2,
    timestamp: "2026-03-03T12:00:00Z",
    status: "completed",
  },
];
