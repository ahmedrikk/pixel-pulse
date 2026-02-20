import { describe, it, expect } from "vitest";
import {
  transformMatch,
  getGameLabel,
  formatMatchScore,
  type PandaScoreMatch,
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
    { opponent: { id: 10, name: "FaZe Clan", image_url: "https://example.com/faze.png" } },
    { opponent: { id: 11, name: "NaVi", image_url: "https://example.com/navi.png" } },
  ],
  results: [
    { score: 2, team_id: 10 },
    { score: 1, team_id: 11 },
  ],
  streams_list: [
    { raw_url: "https://twitch.tv/esl_csgo", main: true, language: "en" },
  ],
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

  it("falls back to TBD when opponents are missing", () => {
    const noOpponents = { ...mockMatch, opponents: [] };
    const result = transformMatch(noOpponents);
    expect(result.team1).toBe("TBD");
    expect(result.team2).toBe("TBD");
  });

  it("includes game and tournament names", () => {
    const result = transformMatch(mockMatch);
    expect(result.game).toBe("Counter-Strike 2");
    expect(result.tournament).toBe("ESL Pro League");
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
