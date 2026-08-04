import { describe, expect, it } from "vitest";
import {
  filterCalendarGames,
  getCalendarGridDays,
  getMonthBounds,
  groupGamesByReleaseDate,
  monthToParam,
  parseMonthParam,
} from "./gameCalendar";

const games = [
  { name: "PC Quest", platforms: ["PC"], rawgRating: 4.1, metacriticScore: 82, releaseDate: "2026-08-04" },
  { name: "Pocket Quest", platforms: ["iOS", "Android"], rawgRating: 0, metacriticScore: null, releaseDate: "2026-08-04" },
  { name: "Console Quest", platforms: ["PS5", "Xbox"], rawgRating: 3.8, metacriticScore: null, releaseDate: "2026-08-12" },
];

describe("game calendar helpers", () => {
  it("round-trips a valid month and falls back for invalid input", () => {
    expect(monthToParam(parseMonthParam("2026-08"))).toBe("2026-08");
    expect(monthToParam(parseMonthParam("not-a-month", new Date(2026, 4, 12)))).toBe("2026-05");
  });

  it("returns inclusive month bounds and complete Sunday-first calendar weeks", () => {
    const month = new Date(2026, 7, 1);
    expect(getMonthBounds(month)).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    const days = getCalendarGridDays(month);
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(0);
    expect(days.at(-1)?.getDay()).toBe(6);
  });

  it("groups releases by their confirmed date", () => {
    const grouped = groupGamesByReleaseDate(games);
    expect(grouped.get("2026-08-04")).toHaveLength(2);
    expect(grouped.get("2026-08-12")?.[0].name).toBe("Console Quest");
  });

  it("filters by search, normalized platform families, and rating", () => {
    expect(filterCalendarGames(games, "console", [], false).map((game) => game.name)).toEqual(["Console Quest"]);
    expect(filterCalendarGames(games, "", ["Mobile"], false).map((game) => game.name)).toEqual(["Pocket Quest"]);
    expect(filterCalendarGames(games, "", ["PlayStation"], true).map((game) => game.name)).toEqual(["Console Quest"]);
    expect(filterCalendarGames(games, "", [], true)).toHaveLength(2);
  });
});
