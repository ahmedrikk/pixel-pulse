import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock3,
  Gamepad2,
  Layers3,
  ScrollText,
} from "lucide-react";
import { format } from "date-fns";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { patchPath, useGamePatchHistory, usePatchGame, type GamePatch, type PatchType } from "@/hooks/useGamePatches";
import { cn } from "@/lib/utils";

const patchTypeStyles: Record<PatchType, { label: string; className: string }> = {
  patch: { label: "Patch", className: "bg-primary/10 text-primary" },
  hotfix: { label: "Hotfix", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  balance: { label: "Balance", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  maintenance: { label: "Maintenance", className: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  update: { label: "Update", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

function PatchEntry({ patch, index }: { patch: GamePatch; index: number }) {
  const type = patchTypeStyles[patch.patchType] ?? patchTypeStyles.update;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.25), duration: 0.25 }}
      className="relative rounded-2xl border bg-card p-4 card-shadow sm:p-5"
    >
      {index === 0 && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary-foreground shadow-sm">
          Current patch
        </span>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", type.className)}>
          {type.label}
        </span>
        {patch.versionLabel && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            {patch.versionLabel}
          </span>
        )}
        <time className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {format(new Date(patch.publishedAt), "MMM d, yyyy")}
        </time>
      </div>

      <h2 className="text-base font-bold leading-snug text-foreground sm:text-lg">
        <Link to={patchPath(patch)} className="transition-colors hover:text-primary">
          {patch.title}
        </Link>
      </h2>

      {patch.summary && (
        <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">
          {patch.summary}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <Link
          to={patchPath(patch)}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Read more <span aria-hidden="true">→</span>
        </Link>
      </div>
    </motion.article>
  );
}

export default function GamePatchHistory() {
  const { gameId } = useParams<{ gameId: string }>();
  const gameQuery = usePatchGame(gameId);
  const historyQuery = useGamePatchHistory(gameId);
  const patches = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.patches) ?? [],
    [historyQuery.data],
  );
  const total = historyQuery.data?.pages[0]?.total ?? gameQuery.data?.patchCount ?? 0;

  if (!gameQuery.isLoading && !gameQuery.data) {
    return <Navigate to="/game-patch" replace />;
  }

  const game = gameQuery.data;

  return (
    <>
      <SiteLayout>
        <div className="pb-16 md:pb-0">
          <Link
            to="/game-patch"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Game Patch
          </Link>

          {gameQuery.isLoading || !game ? (
            <div className="space-y-5">
              <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : (
            <>
              <header className="relative mb-7 h-64 overflow-hidden rounded-2xl border bg-card sm:h-80">
                <img
                  src={game.coverImage}
                  alt={`${game.name} artwork`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                    <ScrollText className="h-4 w-4" />
                  </div>
                  <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">
                    {game.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/85 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm">
                      <Layers3 className="h-3.5 w-3.5 text-primary" />
                      {total.toLocaleString()} {total === 1 ? "patch" : "patches"} archived
                    </span>
                    {game.latestPatchAt && (
                      <span className="rounded-full border bg-card/85 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                        Latest · {format(new Date(game.latestPatchAt), "MMM d, yyyy")}
                      </span>
                    )}
                    <Link
                      to={`/reviews/${game.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-card/85 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm hover:bg-card"
                    >
                      <Gamepad2 className="h-3.5 w-3.5" />
                      Game page
                    </Link>
                  </div>
                </div>
              </header>

              {historyQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-44 animate-pulse rounded-2xl bg-secondary" />
                  ))}
                </div>
              ) : historyQuery.error ? (
                <div className="rounded-2xl border bg-card p-8 text-center">
                  <p className="font-semibold text-foreground">This patch history could not be loaded.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please try again shortly.</p>
                </div>
              ) : patches.length > 0 ? (
                <div className="space-y-4">
                  {patches.map((patch, index) => (
                    <PatchEntry key={patch.id} patch={patch} index={index} />
                  ))}

                  {historyQuery.hasNextPage && (
                    <div className="flex justify-center pt-3">
                      <Button
                        variant="outline"
                        onClick={() => historyQuery.fetchNextPage()}
                        disabled={historyQuery.isFetchingNextPage}
                        className="min-w-44"
                      >
                        {historyQuery.isFetchingNextPage ? "Loading older patches…" : "Load older patches"}
                      </Button>
                    </div>
                  )}

                  {!historyQuery.hasNextPage && patches.length > 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      You have reached the earliest patch available from the official source.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border bg-card p-10 text-center">
                  <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 font-semibold text-foreground">Patch history is being imported</p>
                  <p className="mt-1 text-sm text-muted-foreground">Talus is rewriting the official updates into readable player-first breakdowns. Check back shortly.</p>
                </div>
              )}
            </>
          )}
        </div>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
