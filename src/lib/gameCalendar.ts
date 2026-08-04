import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const GAME_CALENDAR_PLATFORMS = [
  "PC",
  "PlayStation",
  "Xbox",
  "Switch",
  "Mobile",
] as const;

export type GameCalendarPlatform = (typeof GAME_CALENDAR_PLATFORMS)[number];

export interface CalendarFilterableGame {
  name: string;
  platforms: string[];
  rawgRating: number;
  metacriticScore: number | null;
  releaseDate: string;
}
export function monthToParam(date: Date): string {
  return format(date, "yyyy-MM");
}

export function parseMonthParam(value: string | null, fallback = new Date()): Date {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return startOfMonth(fallback);
  const parsed = parse(value, "yyyy-MM", new Date());
  return isValid(parsed) ? startOfMonth(parsed) : startOfMonth(fallback);
}

export function getMonthBounds(date: Date) {
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function getCalendarGridDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 0 }),
  });
}

export function groupGamesByReleaseDate<T extends { releaseDate: string }>(games: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const game of games) {
    const items = grouped.get(game.releaseDate) ?? [];
    items.push(game);
    grouped.set(game.releaseDate, items);
  }
  return grouped;
}

function matchesPlatform(platforms: string[], filter: GameCalendarPlatform): boolean {
  const normalized = platforms.map((platform) => platform.toLowerCase());
  if (filter === "PlayStation") return normalized.some((platform) => platform.startsWith("ps") || platform.includes("playstation"));
  if (filter === "Switch") return normalized.some((platform) => platform.includes("switch") || platform.includes("nintendo"));
  if (filter === "Mobile") return normalized.some((platform) => platform === "ios" || platform === "android" || platform.includes("mobile"));
  return normalized.some((platform) => platform.includes(filter.toLowerCase()));
}

export function filterCalendarGames<T extends CalendarFilterableGame>(
  games: T[],
  search: string,
  platforms: GameCalendarPlatform[],
  ratedOnly: boolean,
): T[] {
  const query = search.trim().toLowerCase();
  return games.filter((game) => {
    if (query && !game.name.toLowerCase().includes(query)) return false;
    if (platforms.length > 0 && !platforms.some((platform) => matchesPlatform(game.platforms, platform))) return false;
    if (ratedOnly && game.rawgRating <= 0 && !game.metacriticScore) return false;
    return true;
  });
}
