import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Gamepad2,
  Lightbulb,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { useDocumentMetadata } from "@/hooks/useDocumentMetadata";
import { useGameDetails } from "@/hooks/useGameDetails";
import { useGamePatch, useRecentGamePatches } from "@/hooks/useGamePatches";

export default function GamePatchDetail() {
  const { gameId, patchId } = useParams<{ gameId: string; patchId: string }>();
  const patchQuery = useGamePatch(patchId);
  const gameQuery = useGameDetails(gameId);
  const recentQuery = useRecentGamePatches(gameId);
  const patch = patchQuery.data;
  const game = gameQuery.data;
  const relatedPatches = recentQuery.data?.filter((item) => item.id !== patchId).slice(0, 3) ?? [];

  useDocumentMetadata({
    title: patch?.metaTitle ?? (patch && game ? `${patch.title} | ${game.name} Patch Notes | Talus` : null),
    description: patch?.metaDescription ?? patch?.summary ?? null,
    canonicalPath: patch && gameId ? `/game-patch/${gameId}/${patch.id}` : null,
  });

  if (!patchQuery.isLoading && (!patch || patch.gameId !== gameId)) {
    return <Navigate to={gameId ? `/game-patch/${gameId}` : "/game-patch"} replace />;
  }

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
            <>
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
                    {patch.versionLabel && (
                      <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{patch.versionLabel}</span>
                    )}
                    <time>{format(new Date(patch.publishedAt), "MMMM d, yyyy")}</time>
                  </div>

                  <h1 className="text-2xl font-black leading-tight text-foreground sm:text-4xl">{patch.title}</h1>
                  <Link
                    to={`/reviews/${gameId}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    View {game?.name ?? gameId} details and reviews
                  </Link>

                  {patch.summary && (
                    <p className="mt-6 rounded-xl border-l-4 border-primary bg-secondary/60 p-4 text-sm font-medium leading-6 text-foreground">
                      {patch.summary}
                    </p>
                  )}

                  {patch.editorial ? (
                    <div className="mt-8">
                      <p className="text-base leading-8 text-muted-foreground sm:text-lg">{patch.editorial.opening}</p>

                      <div className="mt-8 space-y-9">
                        {patch.editorial.sections.map((section, index) => (
                          <section key={`${section.heading}-${index}`}>
                            <h2 className="text-xl font-black leading-snug text-foreground sm:text-2xl">{section.heading}</h2>
                            <div className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">
                              {section.body}
                            </div>
                            {patch.editorial?.callouts[index] && (
                              <aside className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                                <div className="flex gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Lightbulb className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-black text-foreground">{patch.editorial.callouts[index].label}</h3>
                                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                                      {patch.editorial.callouts[index].body}
                                    </p>
                                  </div>
                                </div>
                              </aside>
                            )}
                          </section>
                        ))}
                      </div>

                      <section className="mt-9 rounded-2xl bg-secondary/70 p-5 sm:p-6">
                        <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
                          <Sparkles className="h-5 w-5 text-primary" />
                          Why this patch matters
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{patch.editorial.takeaway}</p>
                      </section>
                    </div>
                  ) : (
                    <div className="mt-7 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">
                      {patch.contentText}
                    </div>
                  )}

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <ScrollText className="h-4 w-4 text-primary" />
                      Rewritten from {patch.sourceName}
                    </span>
                    <a
                      href={patch.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Read the official notes
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </article>

              {relatedPatches.length > 0 && (
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black text-foreground">More {game?.name ?? "game"} patches</h2>
                    <Link to={`/game-patch/${gameId}`} className="text-sm font-semibold text-primary hover:underline">
                      Full archive →
                    </Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {relatedPatches.map((item) => (
                      <Link
                        key={item.id}
                        to={`/game-patch/${item.gameId}/${item.id}`}
                        className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/35"
                      >
                        <time className="text-[11px] text-muted-foreground">{format(new Date(item.publishedAt), "MMM d, yyyy")}</time>
                        <h3 className="mt-2 line-clamp-3 text-sm font-bold leading-5 text-foreground group-hover:text-primary">{item.title}</h3>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          Read more <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
