import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock3, Gamepad2, Layers3, Search, ScrollText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { usePatchGames, type PatchGame } from "@/hooks/useGamePatches";

const typeLabels: Record<string, string> = {
  patch: "Patch",
  hotfix: "Hotfix",
  balance: "Balance",
  maintenance: "Maintenance",
  update: "Update",
};

function timeAgo(value: string | null) {
  if (!value) return "Rewrite in progress";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function PatchGameCard({ game, index }: { game: PatchGame; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.32), duration: 0.25 }}
    >
      <Link
        to={`/game-patch/${game.id}`}
        className="group block overflow-hidden rounded-2xl border bg-card card-shadow transition-all duration-300 hover:-translate-y-1 hover:card-shadow-hover"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
          {game.coverImage ? (
            <img
              src={game.coverImage}
              alt={`${game.name} patch history`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gamepad2 className="h-10 w-10 text-muted-foreground/45" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-bold text-foreground backdrop-blur-sm">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
            {game.patchCount.toLocaleString()} {game.patchCount === 1 ? "patch" : "patches"}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <h2 className="line-clamp-1 font-bold text-foreground transition-colors group-hover:text-primary">
              {game.name}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {game.latestPatchAt ? `Updated ${timeAgo(game.latestPatchAt)}` : timeAgo(null)}
            </div>
          </div>

          <div className="min-h-[52px] rounded-xl bg-secondary/70 px-3 py-2.5">
            {game.latestPatchTitle ? (
              <>
                <span className="mb-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {typeLabels[game.latestPatchType ?? "update"]}
                </span>
                <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground">
                  {game.latestPatchTitle}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Official patch history is being rewritten into the Talus format.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-primary">
            <span>View complete history</span>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function GamePatchCatalog() {
  const [search, setSearch] = useState("");
  const { data: games = [], isLoading, error } = usePatchGames();

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return games;
    return games.filter((game) => game.name.toLowerCase().includes(query));
  }, [games, search]);

  const recentGames = games.filter((game) => game.latestPatchAt).slice(0, 5);

  return (
    <>
      <SiteLayout>
        <div className="space-y-8 pb-16 md:pb-0">
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7"
          >
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ScrollText className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-black text-foreground md:text-4xl">
                <span className="text-gradient">Game Patch</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Patch notes should help you play, not make you decode a developer changelog.
                Talus rewrites every official update into a clear player-first breakdown, then keeps the full history ready whenever you need to look back.
              </p>
            </div>
          </motion.header>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patch history…"
              aria-label="Search every game patch archive"
              className="border-0 bg-secondary pl-10 focus-visible:ring-primary"
            />
          </div>

          {!search && recentGames.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Recently updated</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 mobile-cat-scroll">
                {recentGames.map((game) => (
                  <Link
                    key={game.id}
                    to={`/game-patch/${game.id}`}
                    className="group flex w-[230px] shrink-0 items-center gap-3 rounded-xl border bg-card p-2.5 transition-colors hover:border-primary/35 hover:bg-card/80"
                  >
                    <img
                      src={game.coverImage}
                      alt={game.name}
                      className="h-14 w-20 rounded-lg object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                        {game.name}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {game.latestPatchTitle}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {search ? "Search results" : "All patch archives"}
              </h2>
              {!isLoading && (
                <span className="text-sm text-muted-foreground">
                  {filteredGames.length} game {filteredGames.length === 1 ? "archive" : "archives"}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-2xl bg-secondary" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <p className="font-semibold text-foreground">Patch archives are temporarily unavailable.</p>
                <p className="mt-1 text-sm text-muted-foreground">Please try again shortly.</p>
              </div>
            ) : filteredGames.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredGames.map((game, index) => (
                  <PatchGameCard key={game.id} game={game} index={index} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-10 text-center">
                <Search className="mx-auto h-7 w-7 text-muted-foreground/60" />
                <p className="mt-3 font-semibold text-foreground">No supported game found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different game name.</p>
              </div>
            )}
          </section>
        </div>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
