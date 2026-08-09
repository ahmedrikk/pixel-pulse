import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DescriptionBackfillRun {
  id: string;
  status: "running" | "paused" | "completed" | "cancelled";
  totalTarget: number;
  processed: number;
  succeeded: number;
  failed: number;
  queued: number;
  processing: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface DescriptionBackfillAttempt {
  id: number;
  gameId: string;
  gameName: string;
  attemptNumber: number;
  status: "succeeded" | "failed";
  wordCount: number | null;
  durationMs: number;
  error: string | null;
  createdAt: string;
}

export interface DescriptionBackfillProgress {
  run: DescriptionBackfillRun | null;
  attempts: DescriptionBackfillAttempt[];
}

async function getDescriptionBackfillProgress(): Promise<DescriptionBackfillProgress> {
  // These operational tables are newer than the generated client types. They
  // are read-only here; all writes remain inside service-role database RPCs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: runRow, error: runError } = await db
    .from("game_description_backfill_runs")
    .select("id, status, total_target, processed, succeeded, failed, started_at, updated_at, completed_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;
  if (!runRow) return { run: null, attempts: [] };

  const [{ data: jobRows, error: jobsError }, { data: attemptRows, error: attemptsError }] = await Promise.all([
    db.from("game_description_backfill_jobs").select("status").eq("run_id", runRow.id).limit(5000),
    db.from("game_description_backfill_attempts")
      .select("id, game_id, attempt_number, status, word_count, duration_ms, error, created_at, games!game_description_backfill_attempts_game_id_fkey(name)")
      .eq("run_id", runRow.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (jobsError) throw jobsError;
  if (attemptsError) throw attemptsError;

  const queued = (jobRows ?? []).filter((job: { status: string }) => job.status === "queued").length;
  const processing = (jobRows ?? []).filter((job: { status: string }) => job.status === "processing").length;
  return {
    run: {
      id: runRow.id,
      status: runRow.status,
      totalTarget: Number(runRow.total_target ?? 0),
      processed: Number(runRow.processed ?? 0),
      succeeded: Number(runRow.succeeded ?? 0),
      failed: Number(runRow.failed ?? 0),
      queued,
      processing,
      startedAt: runRow.started_at,
      updatedAt: runRow.updated_at,
      completedAt: runRow.completed_at,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attempts: (attemptRows ?? []).map((attempt: any) => ({
      id: attempt.id,
      gameId: attempt.game_id,
      gameName: Array.isArray(attempt.games) ? attempt.games[0]?.name ?? attempt.game_id : attempt.games?.name ?? attempt.game_id,
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      wordCount: attempt.word_count,
      durationMs: attempt.duration_ms,
      error: attempt.error,
      createdAt: attempt.created_at,
    })),
  };
}

export function useGameDescriptionBackfill() {
  return useQuery({
    queryKey: ["operations", "game-description-backfill"],
    queryFn: getDescriptionBackfillProgress,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
