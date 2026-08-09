import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Monitor, Gamepad2, Search, Flame, Users, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useGameCatalog,
  useCanonicalGameSearch,
  useGenreRankings,
  useRecentPopularGames,
  useTrendingGames,
  type CatalogGame,
} from "@/hooks/useGameCatalog";
import { getTrendingReason, formatPlayerCount, steamScoreToPlayers } from "@/lib/trending";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";

const platformIcons: Record<string, React.ReactNode> = {
  PC: <Monitor className="h-3.5 w-3.5" />,
  PS5: <Gamepad2 className="h-3.5 w-3.5" />,
  Xbox: <Gamepad2 className="h-3.5 w-3.5" />,
  Switch: <Gamepad2 className="h-3.5 w-3.5" />,
};

function RatingBadge({
  rating,
  count,
  label,
}: {
  rating: number;
  count?: number;
  label?: string;
}) {
  if (rating <= 0 && !count) {
    return (
      <span className="text-muted-foreground text-[10px]">
        {label ? `${label}: —` : "Not rated"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium">
      <Star className="h-3 w-3 fill-primary text-primary" />
      <span className="text-foreground">{rating.toFixed(1)}</span>
      {count != null && (
        <span className="text-muted-foreground">({count})</span>
      )}
      {label && <span className="text-muted-foreground ml-0.5">{label}</span>}
    </span>
  );
}

const genreLabels: Record<string, string> = {
  "role-playing-games-rpg": "RPG",
  "massively-multiplayer": "MMO",
  "open-world": "Open World",
};

function genreLabel(genre: string) {
  return genreLabels[genre] ?? genre.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function GenreRankCard({ game, rank }: { game: CatalogGame; rank: number }) {
  return (
    <Link
      to={`/reviews/${game.id}`}
      className="group flex w-[240px] shrink-0 items-center gap-3 rounded-xl border bg-card p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:card-shadow"
    >
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
        {game.coverImage ? (
          <img src={game.coverImage} alt={game.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
        ) : (
          <Gamepad2 className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground/40" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white">#{rank}</span>
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground group-hover:text-primary">{game.name}</h3>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 fill-primary text-primary" />
          {game.ratingCount > 0 ? (
            <><span className="font-bold text-foreground">{game.rating.toFixed(1)}</span><span>· {game.ratingCount} reviews</span></>
          ) : (
            <span>Awaiting Talus reviews</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function GameCard({ game, index }: { game: CatalogGame; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      // Cap the stagger so large result sets (40+ cards) don't animate for
      // multiple seconds — long transform storms can hang the main thread.
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.3 }}
    >
      <Link
        to={`/reviews/${game.id}`}
        className="group block bg-card border rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1"
      >
        {/* Cover Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={game.coverImage}
            alt={game.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

          {/* Rating Badge — community average of USER reviews (Letterboxd-style) */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 px-2.5 py-1.5 rounded-full bg-card/80 backdrop-blur-sm text-xs font-bold">
            <RatingBadge
              rating={game.rating}
              count={game.ratingCount}
              label="Community"
            />
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-2">
          <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {game.name}
          </h3>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {game.releaseDate && game.releaseDate !== "TBA"
              ? new Date(`${game.releaseDate}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
              : "Release date unavailable"}
          </p>
          {game.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {game.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            {/* Platforms */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {game.platforms.slice(0, 3).map((p) => (
                <span
                  key={p}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-[10px] font-medium"
                >
                  {platformIcons[p]}
                  {p}
                </span>
              ))}
            </div>

            {/* RAWG + Metacritic scores */}
            <div className="flex items-center gap-2">
              {game.rawgRating > 0 && (
                <RatingBadge rating={game.rawgRating} label="RAWG" />
              )}
              {game.metacriticScore && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  MC {game.metacriticScore}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function TrendingCard({ game, index }: { game: CatalogGame; index: number }) {
  const reason = getTrendingReason(game);
  const isTop3 = index < 3;
  const hasCommunityRating = game.rating > 0 && game.ratingCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.08, 0.4), duration: 0.3 }}
      className="snap-start shrink-0 w-[160px] sm:w-[180px]"
    >
      <Link
        to={`/reviews/${game.id}`}
        className="group block bg-card border rounded-xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          {game.coverImage ? (
            <img
              src={game.coverImage}
              alt={game.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <Gamepad2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

          {/* Top 3 fire badge */}
          {isTop3 && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold">
              <Flame className="h-3 w-3" />
              #{index + 1}
            </div>
          )}

          {/* Steam player count badge */}
          {game.steamScore && game.steamScore > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium">
              <Users className="h-3 w-3" />
              {formatPlayerCount(steamScoreToPlayers(game.steamScore))}
            </div>
          )}
        </div>
        <div className="p-3 space-y-1">
          <h3 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {game.name}
          </h3>

          {/* Trending reason subtitle */}
          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
            {reason}
          </p>

          {hasCommunityRating ? (
            <RatingBadge
              rating={game.rating}
              count={game.ratingCount}
              label="Community"
            />
          ) : game.rawgRating > 0 ? (
            <RatingBadge rating={game.rawgRating} label="RAWG" />
          ) : (
            <span className="text-muted-foreground text-[10px]">
              Not rated yet
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function GameCatalog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search and require at least 2 characters before hitting RAWG.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const t = setTimeout(() => setDebouncedSearch(trimmed), 600);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const hasSearch = debouncedSearch.length > 0;
  const searchActive = debouncedSearch.length >= 2;
  const searchTooShort = hasSearch && !searchActive;

  // Search spans the canonical Talus catalog and RAWG discovery results.
  const { data: searchResults = [], isLoading: searchLoading, isFetching: searchFetching, error: searchError } = useGameCatalog({
    search: searchActive ? debouncedSearch : undefined,
  });
  const { data: canonicalSearchResults = [], isLoading: canonicalSearchLoading } =
    useCanonicalGameSearch(searchActive ? debouncedSearch : undefined);
  const { data: trendingGames = [], isLoading: trendingLoading } =
    useTrendingGames();
  const { data: genreRankings = [], isLoading: genreRankingsLoading } =
    useGenreRankings();
  const { data: recentPopularGames = [], isLoading: recentPopularLoading } =
    useRecentPopularGames();

  const games = searchActive
    ? [...new Map([...canonicalSearchResults, ...searchResults].map((game) => [game.id, game])).values()]
    : [];
  const isLoading = searchActive && canonicalSearchLoading && searchLoading;
  const recentPopularDisplay = recentPopularGames.length > 0
    ? recentPopularGames
    : trendingGames
        .filter((game) => game.releaseDate && game.releaseDate !== "TBA" && !Number.isNaN(Date.parse(game.releaseDate)))
        .sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate))
        .slice(0, 6);

  return (
    <>
      <SiteLayout>
        <div className="space-y-8 pb-16 md:pb-0">
          {/* Page Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-black text-foreground">
              Video Game Reviews
            </h1>
          </motion.div>

          {/* Search */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search all games to rate…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-0 focus-visible:ring-primary"
              />
            </div>
          </motion.div>

          {/* Trending Games */}
          {!hasSearch && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Trending now</h2>
              </div>
              {trendingLoading ? (
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="shrink-0 w-[160px] sm:w-[180px] h-40 rounded-xl bg-secondary animate-pulse"
                    />
                  ))}
                </div>
              ) : trendingGames.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x">
                  {trendingGames.map((game, i) => (
                    <TrendingCard key={game.id} game={game} index={i} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No trending games right now.
                </p>
              )}
            </motion.div>
          )}

          {!hasSearch && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Recently released popular games</h2>
                <p className="mt-1 text-sm text-muted-foreground">Six recent releases ranked by player interest and review activity.</p>
              </div>
              {recentPopularLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-secondary" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recentPopularDisplay.slice(0, 6).map((game, index) => <GameCard key={game.id} game={game} index={index} />)}
                </div>
              )}
            </section>
          )}

          {!hasSearch && (genreRankingsLoading || genreRankings.length > 0) && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Top games by genre</h2>
                <p className="mt-1 text-sm text-muted-foreground">Community rating balanced by review volume; catalog order fills unrated genres.</p>
              </div>
              {genreRankingsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-secondary" />)}
                </div>
              ) : (
                <div className="space-y-5">
                  {genreRankings.map((group) => (
                    <div key={group.genre}>
                      <h3 className="mb-2 text-sm font-bold text-foreground">{genreLabel(group.genre)}</h3>
                      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                        {group.games.map((game, index) => <GenreRankCard key={game.id} game={game} rank={index + 1} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Search results */}
          {hasSearch && <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                {searchActive ? "Search results" : "Search"}
              </h2>
              {!isLoading && (
                <span className="text-sm text-muted-foreground">{games.length} games</span>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-64 rounded-2xl bg-secondary animate-pulse" />
                ))}
              </div>
            ) : searchTooShort ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">
                  Keep typing to search games…
                </p>
              </div>
            ) : games.length > 0 ? (
              <AnimatePresence mode="popLayout">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {games.map((game, i) => (
                    <GameCard key={game.id} game={game} index={i} />
                  ))}
                </div>
              </AnimatePresence>
            ) : searchFetching && games.length === 0 ? (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <p className="font-semibold text-foreground">Searching the wider game catalog…</p>
                <p className="mt-1 text-sm text-muted-foreground">Existing Talus games appear immediately; new titles may take a little longer.</p>
              </div>
            ) : searchError ? (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <p className="font-semibold text-foreground">The wider game catalog is temporarily unavailable.</p>
                <p className="mt-1 text-sm text-muted-foreground">Talus catalog matches still appear above. Please retry shortly for games not yet in our database.</p>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No games found for “{debouncedSearch}”.</p>
              </div>
            )}
          </div>}
        </div>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
