import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, CircleDashed, Clock3, FileText, RefreshCw, XCircle } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDocumentMetadata } from "@/hooks/useDocumentMetadata";
import { useGameDescriptionBackfill } from "@/hooks/useGameDescriptionBackfill";
import { cn } from "@/lib/utils";

function durationLabel(milliseconds: number) {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${Math.round(milliseconds / 1_000)}s`;
  return `${Math.floor(milliseconds / 60_000)}m ${Math.round((milliseconds % 60_000) / 1_000)}s`;
}

export default function BackfillStatus() {
  const progressQuery = useGameDescriptionBackfill();
  const progress = progressQuery.data;
  const run = progress?.run;
  const percentage = run?.totalTarget ? Math.round((run.processed / run.totalTarget) * 100) : 0;

  useDocumentMetadata({
    title: "Editorial Backfill Status | Talus",
    description: "Live status for the Talus game-description editorial backfill.",
    canonicalPath: "/backfill-status",
  });

  return (
    <>
      <SiteLayout>
        <main className="space-y-5 pb-16 md:pb-0">
          <section className="rounded-2xl border bg-card p-5 card-shadow sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Pre-launch operation</p>
                  <h1 className="mt-1 text-2xl font-black text-foreground sm:text-3xl">Editorial backfill</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Live progress for AI-written game overviews. This page refreshes every 30 seconds.</p>
                </div>
              </div>
              <Button variant="outline" size="icon" onClick={() => progressQuery.refetch()} disabled={progressQuery.isFetching} aria-label="Refresh progress">
                <RefreshCw className={cn("h-4 w-4", progressQuery.isFetching && "animate-spin")} />
              </Button>
            </div>
          </section>

          {progressQuery.isLoading ? (
            <div className="space-y-3"><div className="h-52 animate-pulse rounded-2xl bg-secondary" /><div className="h-80 animate-pulse rounded-2xl bg-secondary" /></div>
          ) : progressQuery.error ? (
            <section className="rounded-2xl border bg-card p-10 text-center">
              <XCircle className="mx-auto h-9 w-9 text-destructive" />
              <h2 className="mt-3 font-bold text-foreground">Progress log unavailable</h2>
              <Button className="mt-4" onClick={() => progressQuery.refetch()}>Try again</Button>
            </section>
          ) : !run ? (
            <section className="rounded-2xl border bg-card p-10 text-center"><CircleDashed className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-semibold">No backfill run has started.</p></section>
          ) : (
            <>
              <section className="rounded-2xl border bg-card p-5 card-shadow sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", run.status === "running" ? "animate-pulse bg-emerald-500" : run.status === "completed" ? "bg-primary" : "bg-amber-500")} />
                      <h2 className="text-lg font-black capitalize text-foreground">{run.status}</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Started {formatDistanceToNowStrict(new Date(run.startedAt), { addSuffix: true })}</p>
                  </div>
                  <div className="text-right"><p className="text-3xl font-black text-primary">{percentage}%</p><p className="text-[11px] text-muted-foreground">{run.processed} of {run.totalTarget} finished</p></div>
                </div>
                <Progress value={percentage} className="mt-5 h-3" />
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ["Succeeded", run.succeeded, "text-emerald-600"],
                    ["Processing", run.processing, "text-primary"],
                    ["Queued", run.queued, "text-foreground"],
                    ["Failed", run.failed, "text-destructive"],
                    ["Target", run.totalTarget, "text-foreground"],
                  ].map(([label, value, tone]) => (
                    <div key={String(label)} className="rounded-xl bg-secondary/70 p-3">
                      <p className={cn("text-xl font-black", String(tone))}>{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border bg-card card-shadow">
                <div className="border-b px-4 py-3 sm:px-5"><h2 className="font-bold text-foreground">Recent attempts</h2><p className="text-xs text-muted-foreground">Newest activity first · failed jobs retry once automatically</p></div>
                {(progress?.attempts.length ?? 0) === 0 ? (
                  <div className="p-10 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 h-7 w-7" />Waiting for the first scheduled batch…</div>
                ) : (
                  <div className="divide-y">
                    {progress?.attempts.map((attempt) => (
                      <article key={attempt.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        {attempt.status === "succeeded" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <p className="truncate text-sm font-bold text-foreground">{attempt.gameName}</p>
                            <time className="text-[10px] text-muted-foreground">{formatDistanceToNowStrict(new Date(attempt.createdAt), { addSuffix: true })}</time>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Attempt {attempt.attemptNumber} · {durationLabel(attempt.durationMs)}{attempt.wordCount ? ` · ${attempt.wordCount} words` : ""}
                          </p>
                          {attempt.error && <p className="mt-1 line-clamp-2 text-[11px] text-destructive">{attempt.error}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
        <BottomNavBar />
      </SiteLayout>
      <Footer />
    </>
  );
}
