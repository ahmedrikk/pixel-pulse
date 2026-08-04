import { useMemo, useState } from "react";
import { addMonths, format, isSameDay, isSameMonth, parseISO, subMonths } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Grid3X3,
  List,
  Monitor,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDocumentMetadata } from "@/hooks/useDocumentMetadata";
import { useGameCalendar, type CalendarGame } from "@/hooks/useGameCalendar";
import {
  filterCalendarGames,
  GAME_CALENDAR_PLATFORMS,
  getCalendarGridDays,
  groupGamesByReleaseDate,
  monthToParam,
  parseMonthParam,
  type GameCalendarPlatform,
} from "@/lib/gameCalendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function releaseRating(game: CalendarGame) {
  if (game.metacriticScore) return `MC ${game.metacriticScore}`;
  if (game.rawgRating > 0) return `${game.rawgRating.toFixed(1)} RAWG`;
  return null;
}

function platformSummary(platforms: string[]) {
  if (platforms.length === 0) return "Platforms TBA";
  return platforms.slice(0, 2).join(" · ") + (platforms.length > 2 ? ` +${platforms.length - 2}` : "");
}

function CompactRelease({ game }: { game: CalendarGame }) {
  return (
    <Link
      to={`/reviews/${game.id}`}
      className="group flex min-w-0 items-center gap-2 rounded-lg border border-transparent bg-secondary/70 p-1.5 transition hover:border-primary/30 hover:bg-primary/5"
      title={`${game.name} — ${platformSummary(game.platforms)}`}
    >
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
        {game.coverImage ? (
          <img src={game.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Gamepad2 className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold leading-tight text-foreground group-hover:text-primary">{game.name}</p>
        <p className="truncate text-[9px] text-muted-foreground">{platformSummary(game.platforms)}</p>
      </div>
    </Link>
  );
}

function ReleaseListCard({ game }: { game: CalendarGame }) {
  const rating = releaseRating(game);
  return (
    <Link
      to={`/reviews/${game.id}`}
      className="group flex gap-3 rounded-xl border bg-card p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:card-shadow"
    >
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-secondary sm:h-24 sm:w-36">
        {game.coverImage ? (
          <img src={game.coverImage} alt={`${game.name} cover`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <Gamepad2 className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="line-clamp-2 text-sm font-bold text-foreground transition-colors group-hover:text-primary sm:text-base">{game.name}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{platformSummary(game.platforms)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {game.genres.slice(0, 2).map((genre) => (
            <span key={genre} className="rounded-full bg-primary/[0.08] px-2 py-0.5 text-[10px] font-medium capitalize text-primary">
              {genre.replace(/-/g, " ")}
            </span>
          ))}
          {rating && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{rating}</span>}
        </div>
      </div>
      <ChevronRight className="my-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default function GameCalendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fallbackMonth = useMemo(() => new Date(), []);
  const month = useMemo(() => parseMonthParam(searchParams.get("month"), fallbackMonth), [fallbackMonth, searchParams]);
  const [search, setSearch] = useState("");
  const [platforms, setPlatforms] = useState<GameCalendarPlatform[]>([]);
  const [ratedOnly, setRatedOnly] = useState(false);
  const [listMode, setListMode] = useState(false);
  const { data: games = [], isLoading, isFetching, error, refetch } = useGameCalendar(month);

  useDocumentMetadata({
    title: `Game Calendar — ${format(month, "MMMM yyyy")} | Talus`,
    description: "Track confirmed PC, PlayStation, Xbox, Switch, and mobile game release dates on Talus.",
    canonicalPath: `/game-calendar?month=${monthToParam(month)}`,
  });

  const filteredGames = useMemo(
    () => filterCalendarGames(games, search, platforms, ratedOnly),
    [games, platforms, ratedOnly, search],
  );
  const groupedGames = useMemo(() => groupGamesByReleaseDate(filteredGames), [filteredGames]);
  const calendarDays = useMemo(() => getCalendarGridDays(month), [month]);
  const releaseDays = useMemo(() => [...groupedGames.entries()].sort(([a], [b]) => a.localeCompare(b)), [groupedGames]);

  const setMonth = (nextMonth: Date) => {
    const next = new URLSearchParams(searchParams);
    next.set("month", monthToParam(nextMonth));
    setSearchParams(next);
  };

  const togglePlatform = (platform: GameCalendarPlatform) => {
    setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
  };

  const nextRelease = filteredGames.find((game) => game.releaseDate >= format(new Date(), "yyyy-MM-dd"));
  const platformCount = new Set(filteredGames.flatMap((game) => game.platforms)).size;

  return (
    <>
      <SiteLayout>
        <main className="space-y-5 pb-16 md:pb-0">
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border bg-card p-5 card-shadow sm:p-6"
          >
            <div className="absolute -right-14 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Plan what to play next</p>
                <h1 className="mt-1 text-2xl font-black text-foreground sm:text-3xl">Game Calendar</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Your next obsession already has a date. Browse confirmed releases month by month, filter by platform, then open any game for Talus reviews, free offers, and patch history.
                </p>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-secondary/70 p-3"><p className="text-lg font-black text-foreground">{filteredGames.length}</p><p className="text-[10px] text-muted-foreground">releases shown</p></div>
              <div className="rounded-xl bg-secondary/70 p-3"><p className="truncate text-sm font-black text-foreground">{nextRelease ? format(parseISO(nextRelease.releaseDate), "MMM d") : "—"}</p><p className="text-[10px] text-muted-foreground">next release</p></div>
              <div className="rounded-xl bg-secondary/70 p-3"><p className="text-lg font-black text-foreground">{platformCount}</p><p className="text-[10px] text-muted-foreground">platforms</p></div>
            </div>
          </motion.section>

          <section className="overflow-hidden rounded-2xl border bg-card card-shadow">
            <div className="flex items-center justify-between border-b p-3 sm:p-4">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(subMonths(month, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h2 className="text-lg font-black text-foreground sm:text-xl">{format(month, "MMMM yyyy")}</h2>
                <button type="button" onClick={() => setMonth(new Date())} className="text-[11px] font-semibold text-primary hover:underline">Jump to today</button>
              </div>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3 border-b bg-secondary/20 p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a release…" className="bg-card pl-9" />
                </div>
                <div className="hidden rounded-lg border bg-card p-1 sm:flex">
                  <Button variant={!listMode ? "secondary" : "ghost"} size="sm" onClick={() => setListMode(false)} aria-label="Calendar view"><Grid3X3 className="h-4 w-4" /></Button>
                  <Button variant={listMode ? "secondary" : "ghost"} size="sm" onClick={() => setListMode(true)} aria-label="List view"><List className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Platforms</span>
                {GAME_CALENDAR_PLATFORMS.map((platform) => (
                  <button
                    type="button"
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition",
                      platforms.includes(platform) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {platform}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRatedOnly((value) => !value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition",
                    ratedOnly ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Star className="h-3 w-3" /> Rated
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary" />)}
              </div>
            ) : error ? (
              <div className="px-5 py-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-3 font-bold text-foreground">The release calendar could not load</h3>
                <p className="mt-1 text-sm text-muted-foreground">The calendar service may be refreshing. Try once more.</p>
                <Button className="mt-4" onClick={() => refetch()}>Try again</Button>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <Sparkles className="mx-auto h-10 w-10 text-primary/40" />
                <h3 className="mt-3 font-bold text-foreground">No matching releases</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try another month or clear some filters.</p>
                {(search || platforms.length || ratedOnly) && <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setPlatforms([]); setRatedOnly(false); }}>Clear filters</Button>}
              </div>
            ) : (
              <>
                {!listMode && (
                  <div className="hidden md:block">
                    <div className="grid grid-cols-7 border-b bg-secondary/30">
                      {WEEKDAYS.map((day) => <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7">
                      {calendarDays.map((day) => {
                        const dateKey = format(day, "yyyy-MM-dd");
                        const dayGames = groupedGames.get(dateKey) ?? [];
                        const inMonth = isSameMonth(day, month);
                        const today = isSameDay(day, new Date());
                        return (
                          <div key={dateKey} className={cn("min-h-32 border-b border-r p-1.5 last:border-r-0", !inMonth && "bg-secondary/20 text-muted-foreground/40", inMonth && dayGames.length > 0 && "bg-primary/[0.018]")}>
                            <span className={cn("mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", today && "bg-primary text-primary-foreground")}>{format(day, "d")}</span>
                            <div className="space-y-1">
                              {dayGames.slice(0, 2).map((game) => <CompactRelease key={game.id} game={game} />)}
                              {dayGames.length > 2 && <button type="button" onClick={() => setListMode(true)} className="w-full text-center text-[10px] font-bold text-primary hover:underline">+{dayGames.length - 2} more</button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={cn("space-y-5 p-3 sm:p-4", !listMode && "md:hidden")}>
                  {releaseDays.map(([date, dayGames]) => (
                    <section key={date}>
                      <div className="mb-2 flex items-center gap-3">
                        <div className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border bg-secondary", isSameDay(parseISO(date), new Date()) && "border-primary bg-primary text-primary-foreground")}>
                          <span className="text-[9px] font-bold uppercase">{format(parseISO(date), "EEE")}</span>
                          <span className="text-lg font-black leading-none">{format(parseISO(date), "d")}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">{format(parseISO(date), "EEEE, MMMM d")}</h3>
                          <p className="text-xs text-muted-foreground">{dayGames.length} {dayGames.length === 1 ? "release" : "releases"}</p>
                        </div>
                      </div>
                      <div className="space-y-2 pl-0 sm:pl-14">
                        {dayGames.map((game) => <ReleaseListCard key={game.id} game={game} />)}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}

            <div className="flex flex-col gap-1 border-t bg-secondary/20 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> Confirmed dates can change; Talus refreshes them throughout the day.</span>
              <span className="font-semibold text-primary">
                Data from <a href="https://rawg.io/" target="_blank" rel="noreferrer" className="hover:underline">RAWG</a> · <a href="https://www.igdb.com/" target="_blank" rel="noreferrer" className="hover:underline">IGDB</a>
              </span>
            </div>
          </section>

          {isFetching && !isLoading && <p className="text-center text-xs text-muted-foreground">Refreshing release dates…</p>}
        </main>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
