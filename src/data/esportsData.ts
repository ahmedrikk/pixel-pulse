export interface EsportsTeam {
  name: string;
  logo: string;
  shortName: string;
  flag: string; // country flag emoji
  probability: number; // win probability 0-100
  form: ("W" | "L" | "D")[]; // last 5 results
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
  streamUrl?: string;
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
  // ── Live ──
  {
    id: "live-1",
    gameTitle: "valorant",
    leagueName: "VCT Americas 2026 — Stage 1",
    format: "Bo3",
    teamA: { name: "Sentinels", logo: "🔴", shortName: "SEN", flag: "🇺🇸", probability: 55, form: ["W","W","L","W","W"] },
    teamB: { name: "Fnatic", logo: "🟠", shortName: "FNC", flag: "🇬🇧", probability: 45, form: ["W","L","W","W","L"] },
    scoreA: 1, scoreB: 1,
    timestamp: "2026-03-05T18:00:00Z",
    status: "live",
    streamUrl: "https://twitch.tv/valorant",
  },
  {
    id: "live-2",
    gameTitle: "cs2",
    leagueName: "IEM Katowice 2026 — Grand Final",
    format: "Bo5",
    teamA: { name: "Natus Vincere", logo: "🟡", shortName: "NAVI", flag: "🇺🇦", probability: 62, form: ["W","W","W","L","W"] },
    teamB: { name: "FaZe Clan", logo: "🔴", shortName: "FaZe", flag: "🇪🇺", probability: 38, form: ["L","W","L","W","W"] },
    scoreA: 2, scoreB: 1,
    timestamp: "2026-03-05T16:00:00Z",
    status: "live",
    streamUrl: "https://twitch.tv/esl_csgo",
  },
  {
    id: "live-3",
    gameTitle: "lol",
    leagueName: "LCK Spring 2026 — Playoffs",
    format: "Bo5",
    teamA: { name: "T1", logo: "🔴", shortName: "T1", flag: "🇰🇷", probability: 52, form: ["W","L","W","W","W"] },
    teamB: { name: "Gen.G", logo: "🟡", shortName: "GEN", flag: "🇰🇷", probability: 48, form: ["W","W","L","W","L"] },
    scoreA: 2, scoreB: 2,
    timestamp: "2026-03-05T10:00:00Z",
    status: "live",
    streamUrl: "https://twitch.tv/lck",
  },

  // ── Upcoming — March 6 ──
  {
    id: "upcoming-1",
    gameTitle: "valorant",
    leagueName: "VCT EMEA 2026 — Stage 1",
    format: "Bo3",
    teamA: { name: "Team Vitality", logo: "🐝", shortName: "VIT", flag: "🇫🇷", probability: 60, form: ["W","W","W","L","W"] },
    teamB: { name: "Team Heretics", logo: "🟣", shortName: "TH", flag: "🇪🇸", probability: 40, form: ["L","W","L","L","W"] },
    scoreA: null, scoreB: null,
    timestamp: "2026-03-06T14:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-2",
    gameTitle: "dota2",
    leagueName: "DreamLeague Season 23",
    format: "Bo3",
    teamA: { name: "Team Spirit", logo: "🐉", shortName: "TS", flag: "🇷🇺", probability: 58, form: ["W","W","L","W","L"] },
    teamB: { name: "Tundra Esports", logo: "🧊", shortName: "TUN", flag: "🇪🇺", probability: 42, form: ["L","L","W","W","L"] },
    scoreA: null, scoreB: null,
    timestamp: "2026-03-06T16:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-3",
    gameTitle: "overwatch",
    leagueName: "Overwatch Champions Series 2026",
    format: "Bo5",
    teamA: { name: "San Francisco Shock", logo: "⚡", shortName: "SFS", flag: "🇺🇸", probability: 47, form: ["L","W","W","L","W"] },
    teamB: { name: "Seoul Dynasty", logo: "🐯", shortName: "SEO", flag: "🇰🇷", probability: 53, form: ["W","W","W","L","W"] },
    scoreA: null, scoreB: null,
    timestamp: "2026-03-06T09:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-4",
    gameTitle: "cs2",
    leagueName: "BLAST Premier Spring 2026",
    format: "Bo3",
    teamA: { name: "Vitality", logo: "🐝", shortName: "VIT", flag: "🇫🇷", probability: 65, form: ["W","W","W","W","L"] },
    teamB: { name: "G2 Esports", logo: "⬛", shortName: "G2", flag: "🇪🇺", probability: 35, form: ["L","W","L","L","W"] },
    scoreA: null, scoreB: null,
    timestamp: "2026-03-06T19:00:00Z",
    status: "upcoming",
  },

  // ── Upcoming — March 7 ──
  {
    id: "upcoming-5",
    gameTitle: "lol",
    leagueName: "LEC Winter 2026 — Week 8",
    format: "Bo3",
    teamA: { name: "G2 Esports", logo: "⬛", shortName: "G2", flag: "🇪🇺", probability: 55, form: ["W","L","W","W","W"] },
    teamB: { name: "Fnatic", logo: "🟠", shortName: "FNC", flag: "🇬🇧", probability: 45, form: ["W","W","L","L","W"] },
    scoreA: null, scoreB: null,
    timestamp: "2026-03-07T17:00:00Z",
    status: "upcoming",
  },
  {
    id: "upcoming-6",
    gameTitle: "r6",
    leagueName: "Six Invitational 2026",
    format: "Bo3",
    teamA: { name: "Team BDS", logo: "🔵", shortName: "BDS", flag: "🇫🇷", probability: 50, form: ["W","L","W","L","W"] },
    teamB: { name: "w7m esports", logo: "🟢", shortName: "W7M", flag: "🇧🇷", probability: 50, form: ["W","W","L","W","L"] },
    scoreA: null, scoreB: null,
    timestamp: "2026-03-07T20:00:00Z",
    status: "upcoming",
  },

  // ── Completed — March 4 ──
  {
    id: "past-1",
    gameTitle: "cs2",
    leagueName: "IEM Katowice 2026 — Semifinal",
    format: "Bo3",
    teamA: { name: "Natus Vincere", logo: "🟡", shortName: "NAVI", flag: "🇺🇦", probability: 70, form: ["W","W","W","L","W"] },
    teamB: { name: "Team Liquid", logo: "🔵", shortName: "TL", flag: "🇺🇸", probability: 30, form: ["L","L","W","L","W"] },
    scoreA: 2, scoreB: 0,
    timestamp: "2026-03-04T15:00:00Z",
    status: "completed",
  },
  {
    id: "past-2",
    gameTitle: "valorant",
    leagueName: "VCT Pacific 2026 — Stage 1",
    format: "Bo3",
    teamA: { name: "DRX", logo: "🐲", shortName: "DRX", flag: "🇰🇷", probability: 45, form: ["L","W","L","W","L"] },
    teamB: { name: "Paper Rex", logo: "📄", shortName: "PRX", flag: "🇸🇬", probability: 55, form: ["W","W","W","L","W"] },
    scoreA: 1, scoreB: 2,
    timestamp: "2026-03-04T11:00:00Z",
    status: "completed",
  },
  {
    id: "past-3",
    gameTitle: "lol",
    leagueName: "LCK Spring 2026 — Week 7",
    format: "Bo3",
    teamA: { name: "Hanwha Life", logo: "🟢", shortName: "HLE", flag: "🇰🇷", probability: 60, form: ["W","W","L","W","W"] },
    teamB: { name: "DK", logo: "🔵", shortName: "DK", flag: "🇰🇷", probability: 40, form: ["L","L","W","L","W"] },
    scoreA: 2, scoreB: 1,
    timestamp: "2026-03-04T08:00:00Z",
    status: "completed",
  },

  // ── Completed — March 3 ──
  {
    id: "past-4",
    gameTitle: "dota2",
    leagueName: "DreamLeague Season 23 — Group Stage",
    format: "Bo3",
    teamA: { name: "Team Falcons", logo: "🦅", shortName: "FAL", flag: "🇸🇦", probability: 52, form: ["W","L","W","W","L"] },
    teamB: { name: "Gaimin Gladiators", logo: "⚔️", shortName: "GG", flag: "🇪🇺", probability: 48, form: ["L","W","W","L","W"] },
    scoreA: 2, scoreB: 1,
    timestamp: "2026-03-03T14:00:00Z",
    status: "completed",
  },
  {
    id: "past-5",
    gameTitle: "overwatch",
    leagueName: "Overwatch Champions Series 2026",
    format: "Bo5",
    teamA: { name: "Toronto Defiant", logo: "⬛", shortName: "TOR", flag: "🇨🇦", probability: 65, form: ["W","W","W","L","W"] },
    teamB: { name: "London Spitfire", logo: "🔵", shortName: "LDN", flag: "🇬🇧", probability: 35, form: ["L","L","W","L","L"] },
    scoreA: 3, scoreB: 1,
    timestamp: "2026-03-03T18:00:00Z",
    status: "completed",
  },
  {
    id: "past-6",
    gameTitle: "r6",
    leagueName: "Six Invitational 2026 — Group Stage",
    format: "Bo3",
    teamA: { name: "Team Secret", logo: "🃏", shortName: "SEC", flag: "🇪🇺", probability: 40, form: ["L","L","W","L","L"] },
    teamB: { name: "FaZe Clan", logo: "🔴", shortName: "FaZe", flag: "🇧🇷", probability: 60, form: ["W","W","L","W","W"] },
    scoreA: 0, scoreB: 2,
    timestamp: "2026-03-03T12:00:00Z",
    status: "completed",
  },
];
