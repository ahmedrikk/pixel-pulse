import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Gamepad2, ScrollText } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { useGameDetails } from "@/hooks/useGameDetails";
import { useGamePatch } from "@/hooks/useGamePatches";

export default function GamePatchDetail() {
  const { gameId, patchId } = useParams<{ gameId: string; patchId: string }>();
  const patchQuery = useGamePatch(patchId);
  const gameQuery = useGameDetails(gameId);

  if (!patchQuery.isLoading && (!patchQuery.data || patchQuery.data.gameId !== gameId)) {
    return <Navigate to={gameId ? `/game-patch/${gameId}` : "/game-patch"} replace />;
  }

  const patch = patchQuery.data;
  const game = gameQuery.data;

  return (
    <>
      <SiteLayout>
        <main className="pb-16 md:pb-0">
          <Link
            to={`/game-patch/${gameId}`}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Complete patch history
          </Link>

          {patchQuery.isLoading || !patch ? (
            <div className="space-y-4">
              <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
              <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
            </div>
          ) : (
            <article className="overflow-hidden rounded-2xl border bg-card card-shadow">
              {(patch.imageUrl || game?.coverImage) && (
                <div className="relative h-56 overflow-hidden sm:h-72">
                  <img
                    src={patch.imageUrl || game?.coverImage}
                    alt={`${game?.name ?? gameId} patch artwork`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent" />
                </div>
              )}

              <div className="p-5 sm:p-8">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold uppercase tracking-wide text-primary">
                    {patch.patchType}
                  </span>
                  {patch.versionLabel && <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{patch.versionLabel}</span>}
                  <time>{format(new Date(patch.publishedAt), "MMMM d, yyyy")}</time>
                </div>

                <h1 className="text-2xl font-black leading-tight text-foreground sm:text-4xl">{patch.title}</h1>
                <Link to={`/reviews/${gameId}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  <Gamepad2 className="h-4 w-4" />
                  {game?.name ?? gameId}
                </Link>

                {patch.summary && (
                  <p className="mt-6 rounded-xl border-l-4 border-primary bg-secondary/60 p-4 text-sm font-medium leading-6 text-foreground">
                    {patch.summary}
                  </p>
                )}

                <div className="mt-6 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">
                  {patch.contentText || patch.summary || "The official source did not include additional patch details."}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <ScrollText className="h-4 w-4 text-primary" />
                    Source · {patch.sourceName}
                  </span>
                  <a
                    href={patch.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    Official notes
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </article>
          )}
        </main>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
