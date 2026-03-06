// Edge Case Tests for pandascore.ts
// These tests identify potential issues not covered by existing tests

import { describe, it, expect } from "vitest";
import {
  transformMatch,
  getGameLabel,
  formatMatchScore,
  type PandaScoreMatch,
} from "./pandascore";

// ============================================
// EDGE CASE 1: Results don't match team_ids
// ============================================
const mockMatchMismatchedResults: PandaScoreMatch = {
  id: 1,
  name: "FaZe vs NaVi",
  status: "running",
  begin_at: "2026-02-20T15:00:00Z",
  videogame: { name: "Counter-Strike 2", slug: "cs-go" },
  tournament: { name: "ESL Pro League" },
  league: { name: "ESL" },
  opponents: [
    { opponent: { id: 100, name: "FaZe Clan", image_url: "https://example.com/faze.png" } },
    { opponent: { id: 200, name: "NaVi", image_url: "https://example.com/navi.png" } },
  ],
  // Results have different team_ids than opponents!
  results: [
    { score: 2, team_id: 10 },  // Different from opponent ids
    { score: 1, team_id: 11 },  // Different from opponent ids
  ],
  streams_list: [],
};

describe("EDGE CASE: Mismatched team_ids in results", () => {
  it("should handle when results team_ids don't match opponent ids", () => {
    const result = transformMatch(mockMatchMismatchedResults);
    // Current implementation uses team_id lookup, so scores will be 0
    expect(result.score1).toBe(0); // Falls back to 0
    expect(result.score2).toBe(0); // Falls back to 0
  });
});

// ============================================
// EDGE CASE 2: Only 1 opponent (incomplete match)
// ============================================
const mockMatchOneOpponent: PandaScoreMatch = {
  id: 2,
  name: "TBD Match",
  status: "not_started",
  begin_at: "2026-02-20T18:00:00Z",
  videogame: { name: "League of Legends", slug: "lol" },
  tournament: { name: "Worlds" },
  league: { name: "Riot" },
  opponents: [
    { opponent: { id: 1, name: "T1", image_url: null } },
    // Missing second opponent
  ],
  results: [],
  streams_list: [],
};

describe("EDGE CASE: Only one opponent", () => {
  it("should handle single opponent with TBD for second team", () => {
    const result = transformMatch(mockMatchOneOpponent);
    expect(result.team1).toBe("T1");
    expect(result.team2).toBe("TBD");
  });
});

// ============================================
// EDGE CASE 3: Empty opponents array
// ============================================
const mockMatchNoOpponents: PandaScoreMatch = {
  id: 3,
  name: "Unknown Match",
  status: "not_started",
  begin_at: null,
  videogame: { name: "Valorant", slug: "valorant" },
  tournament: { name: "VCT" },
  league: { name: "Riot" },
  opponents: [],
  results: [],
  streams_list: [],
};

describe("EDGE CASE: No opponents", () => {
  it("should handle empty opponents array", () => {
    const result = transformMatch(mockMatchNoOpponents);
    expect(result.team1).toBe("TBD");
    expect(result.team2).toBe("TBD");
  });
});

// ============================================
// EDGE CASE 4: Non-English stream only
// ============================================
const mockMatchNonEnglishStream: PandaScoreMatch = {
  id: 4,
  name: "Match with non-English stream",
  status: "running",
  begin_at: "2026-02-20T15:00:00Z",
  videogame: { name: "Dota 2", slug: "dota2" },
  tournament: { name: "TI" },
  league: { name: "Valve" },
  opponents: [
    { opponent: { id: 1, name: "Team A", image_url: null } },
    { opponent: { id: 2, name: "Team B", image_url: null } },
  ],
  results: [
    { score: 1, team_id: 1 },
    { score: 0, team_id: 2 },
  ],
  streams_list: [
    { raw_url: "https://twitch.tv/russian", main: true, language: "ru" },
    { raw_url: "https://twitch.tv/spanish", main: false, language: "es" },
  ],
};

describe("EDGE CASE: Non-English streams", () => {
  it("should fall back to any main stream when no English stream", () => {
    const result = transformMatch(mockMatchNonEnglishStream);
    // Should pick Russian stream (main=true, even though not English)
    expect(result.streamUrl).toBe("https://twitch.tv/russian");
  });
});

// ============================================
// EDGE CASE 5: No main streams
// ============================================
const mockMatchNoMainStream: PandaScoreMatch = {
  id: 5,
  name: "Match with no main stream",
  status: "running",
  begin_at: "2026-02-20T15:00:00Z",
  videogame: { name: "Overwatch", slug: "ow2" },
  tournament: { name: "OWCS" },
  league: { name: "Blizzard" },
  opponents: [
    { opponent: { id: 1, name: "Team A", image_url: null } },
    { opponent: { id: 2, name: "Team B", image_url: null } },
  ],
  results: [],
  streams_list: [
    { raw_url: "https://twitch.tv/costream1", main: false, language: "en" },
    { raw_url: "https://twitch.tv/costream2", main: false, language: "en" },
  ],
};

describe("EDGE CASE: No main streams", () => {
  it("should return null when no main stream available", () => {
    const result = transformMatch(mockMatchNoMainStream);
    // Current implementation requires main=true
    expect(result.streamUrl).toBeNull();
  });
});

// ============================================
// EDGE CASE 6: Results array empty
// ============================================
const mockMatchEmptyResults: PandaScoreMatch = {
  id: 6,
  name: "Match starting soon",
  status: "not_started",
  begin_at: "2026-02-20T20:00:00Z",
  videogame: { name: "Rainbow Six Siege", slug: "r6" },
  tournament: { name: "Six Invitational" },
  league: { name: "Ubisoft" },
  opponents: [
    { opponent: { id: 1, name: "Team A", image_url: null } },
    { opponent: { id: 2, name: "Team B", image_url: null } },
  ],
  results: [], // Empty for upcoming matches
  streams_list: [],
};

describe("EDGE CASE: Empty results array", () => {
  it("should handle empty results for upcoming matches", () => {
    const result = transformMatch(mockMatchEmptyResults);
    expect(result.score1).toBe(0);
    expect(result.score2).toBe(0);
    expect(result.status).toBe("not_started");
  });
});

// ============================================
// EDGE CASE 7: Unknown/edge game names
// ============================================
describe("EDGE CASE: getGameLabel with edge cases", () => {
  it("should handle empty string", () => {
    expect(getGameLabel("")).toBe("");
  });
  
  it("should handle null/undefined gracefully", () => {
    // @ts-expect-error Testing runtime behavior
    expect(getGameLabel(null)).toBeNull();
    // @ts-expect-error Testing runtime behavior  
    expect(getGameLabel(undefined)).toBeUndefined();
  });
  
  it("should handle very long game names", () => {
    const longName = "A".repeat(1000);
    expect(getGameLabel(longName)).toBe(longName);
  });
  
  it("should handle special characters", () => {
    expect(getGameLabel("Game <script>alert('xss')</script>")).toBe("Game <script>alert('xss')</script>");
  });
});

// ============================================
// EDGE CASE 8: formatMatchScore edge cases
// ============================================
describe("EDGE CASE: formatMatchScore with extreme values", () => {
  it("should handle very high scores", () => {
    expect(formatMatchScore(999, 888)).toBe("999 - 888");
  });
  
  it("should handle negative scores (edge case)", () => {
    expect(formatMatchScore(-1, -5)).toBe("-1 - -5");
  });
  
  it("should handle decimal scores", () => {
    // @ts-expect-error Testing runtime behavior
    expect(formatMatchScore(1.5, 2.5)).toBe("1.5 - 2.5");
  });
});

// ============================================
// EDGE CASE 9: Null begin_at date
// ============================================
const mockMatchNullDate: PandaScoreMatch = {
  id: 7,
  name: "Match with unknown time",
  status: "not_started",
  begin_at: null,
  videogame: { name: "PUBG Mobile", slug: "pubgm" },
  tournament: { name: "PMGC" },
  league: { name: "Tencent" },
  opponents: [
    { opponent: { id: 1, name: "Team A", image_url: null } },
    { opponent: { id: 2, name: "Team B", image_url: null } },
  ],
  results: [],
  streams_list: [],
};

describe("EDGE CASE: Null begin_at", () => {
  it("should preserve null begin_at", () => {
    const result = transformMatch(mockMatchNullDate);
    expect(result.begin_at).toBeNull();
  });
});
