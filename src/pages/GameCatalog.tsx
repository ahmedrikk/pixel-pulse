import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Monitor, Gamepad2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useGameCatalog, useMyRatedGames, type CatalogGame } from "@/hooks/useGameCatalog";
import { useAuthGate } from "@/contexts/AuthGateContext";
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

          {/* Rating Badge — community average of USER reviews (Letterboxd-style) */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-card/80 backdrop-blur-sm text-xs font-bold">
            {game.ratingCount > 0 ? (
              <>
                <Star className="h-3 w-3 fill-primary text-primary" />
                <span className="text-foreground">{game.rating.toFixed(1)}</span>
                <span className="text-muted-foreground font-medium">({game.ratingCount})</span>
              </>
            ) : (
              <>
                <Star className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Not rated</span>
              </>
            )}
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
  const { user, isAuthenticated, openAuthModal } = useAuthGate();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search to avoid hammering the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const searching = debouncedSearch.trim().length > 0;

  // Default view = the games YOU'VE rated (Letterboxd model).
  const { data: myGames = [], isLoading: myLoading } = useMyRatedGames(user?.id);
  // While searching, look across the whole catalog so you can find a game to rate.
  const { data: searchResults = [], isLoading: searchLoading } = useGameCatalog({
    search: searching ? debouncedSearch : undefined,
  });

  const games = searching ? searchResults : myGames;
  const isLoading = searching ? searchLoading : myLoading;

  return (
    <>
      <SiteLayout>
      <div className="space-y-8 pb-16 md:pb-0">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-black text-foreground">
            Your <span className="text-gradient">Reviews</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Games you've rated. Cards show the community average — open one to see your own rating.
          </p>
        </motion.div>

        {/* Search (across the whole catalog, so you can find & rate new games) */}
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

        {/* Games Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              {searching ? "Search results" : "Games you've rated"}
            </h2>
            {!isLoading && (
              <span className="text-sm text-muted-foreground">{games.length} games</span>
            )}
          </div>

          {!isAuthenticated && !searching ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-4">Log in to track the games you rate.</p>
              <button
                onClick={() => openAuthModal("review")}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium"
              >
                Log in
              </button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : games.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {games.map((game, i) => (
                  <GameCard key={game.id} game={game} index={i} />
                ))}
              </div>
            </AnimatePresence>
          ) : searching ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">No games found for “{debouncedSearch}”.</p>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">You haven't rated any games yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                React to a game in the news feed to rate it, or search above.
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
