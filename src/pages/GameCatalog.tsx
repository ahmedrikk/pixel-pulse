import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Monitor, Gamepad2, Search, Flame, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useGameCatalog,
  useCommunityReviewedGames,
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

  // Default view = community-reviewed games.
  const { data: communityGames = [], isLoading: communityLoading } =
    useCommunityReviewedGames();
  // While searching, look across the whole catalog so you can find a game to rate.
  const { data: searchResults = [], isLoading: searchLoading } = useGameCatalog({
    search: searchActive ? debouncedSearch : undefined,
  });
  const { data: trendingGames = [], isLoading: trendingLoading } =
    useTrendingGames();

  const games = searchActive ? searchResults : communityGames;
  const isLoading = searchActive ? searchLoading : communityLoading;

  return (
    <>
      <SiteLayout>
        <div className="space-y-8 pb-16 md:pb-0">
          {/* Page Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-black text-foreground">
              <span className="text-gradient">Review</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Community reviews from Talus players plus RAWG ratings.
              Open a game to read reviews or write your own.
            </p>
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
                <h2 className="text-lg font-bold text-foreground">Trending Games</h2>
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

          {/* Games Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                {searchActive ? "Search results" : searchTooShort ? "Search" : "Community reviewed games"}
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
            ) : searchActive ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No games found for “{debouncedSearch}”.</p>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">
                  No community reviews yet.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Search for a game above and be the first to review it.
                </p>
              </div>
            )}
          </div>
        </div>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
