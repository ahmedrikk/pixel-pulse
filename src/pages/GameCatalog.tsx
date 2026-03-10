import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, TrendingUp, Monitor, Gamepad2, Search, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useGameCatalog, type CatalogGame } from "@/hooks/useGameCatalog";
import { SiteLayout } from "@/components/SiteLayout";
import { Input } from "@/components/ui/input";

const GENRES = [
  { id: "all",        label: "All Games",   icon: "🎮" },
  { id: "action-rpg", label: "Action RPG", icon: "⚔️" },
  { id: "fps",        label: "FPS",         icon: "🔫" },
  { id: "adventure",  label: "Adventure",   icon: "🗺️" },
  { id: "strategy",   label: "Strategy",    icon: "♟️" },
  { id: "racing",     label: "Racing",      icon: "🏎️" },
  { id: "sports",     label: "Sports",      icon: "⚽" },
];

const platformIcons: Record<string, React.ReactNode> = {
  PC: <Monitor className="h-3.5 w-3.5" />,
  PS5: <Gamepad2 className="h-3.5 w-3.5" />,
  Xbox: <Gamepad2 className="h-3.5 w-3.5" />,
  Switch: <Gamepad2 className="h-3.5 w-3.5" />,
};

function GameCard({ game, index }: { game: CatalogGame; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
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

          {/* Trending Badge */}
          {game.trending && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/90 text-accent-foreground text-xs font-bold backdrop-blur-sm">
              <Flame className="h-3 w-3" />
              Trending
            </div>
          )}

          {/* Rating Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-card/80 backdrop-blur-sm text-xs font-bold">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="text-foreground">{game.rating}</span>
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

            {/* Metacritic score if available */}
            {game.metacriticScore && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                MC {game.metacriticScore}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function GameCatalog() {
  const [activeGenre, setActiveGenre] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search to avoid hammering API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: games = [], isLoading, error } = useGameCatalog({
    search: debouncedSearch || undefined,
    genre: activeGenre === "all" ? undefined : activeGenre,
  });

  const trendingGames = games.filter((g) => g.trending);
  const filteredGames = games;   // hook already filters by genre/search

  return (
    <SiteLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-black text-foreground">
            Game <span className="text-gradient">Reviews</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse community reviews and ratings for the latest games.
          </p>
        </motion.div>

        {/* Trending Section */}
        {trendingGames.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Trending Now</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {trendingGames.slice(0, 6).map((game) => (
                <Link
                  key={game.id}
                  to={`/reviews/${game.id}`}
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden card-shadow hover:card-shadow-hover transition-all hover:-translate-y-1"
                >
                  <img
                    src={game.coverImage}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {game.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      <span className="text-xs font-bold text-foreground">{game.rating}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Search + Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-0 focus-visible:ring-primary"
            />
          </div>

          {/* Genre Filters */}
          <div className="flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <button
                key={genre.id}
                onClick={() => setActiveGenre(genre.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  activeGenre === genre.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <span>{genre.icon}</span>
                <span>{genre.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Games Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              {activeGenre === "all" ? "All Games" : GENRES.find((g) => g.id === activeGenre)?.label}
            </h2>
            {!isLoading && (
              <span className="text-sm text-muted-foreground">{filteredGames.length} games</span>
            )}
          </div>

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl bg-secondary animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-center text-muted-foreground py-12">
              Failed to load games. Please try again.
            </p>
          )}

          {!isLoading && !error && (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGames.map((game, i) => (
                  <GameCard key={game.id} game={game} index={i} />
                ))}
              </div>
            </AnimatePresence>
          )}

          {!isLoading && !error && filteredGames.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">No games found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
