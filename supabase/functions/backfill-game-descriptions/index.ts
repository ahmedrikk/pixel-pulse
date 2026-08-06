import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown backfill error";
  }
}

interface BackfillJob {
  run_id: string;
  job_id: string;
  game_id: string;
  attempt_number: number;
  name: string;
  developer: string | null;
  publisher: string | null;
  release_date: string | null;
  genres: string[];
  platforms: string[];
  source_summary: string;
}

interface DescriptionResult {
  ok?: boolean;
  wordCount?: number;
  description?: string;
  error?: string;
}

class DescriptionCallError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "DescriptionCallError";
  }
}

function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof DescriptionCallError && [429, 502, 503, 504].includes(error.status)) return true;
  const message = describeError(error);
  return /\b429\b|quota exceeded|current quota|temporar(?:y|ily)|timeout|timed out|fetch failed/i.test(message);
}

async function invokeDescription(
  supabaseUrl: string,
  anonKey: string,
  job: BackfillJob,
): Promise<DescriptionResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/enrich-game-description`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      gameId: job.game_id,
      facts: {
        name: job.name,
        developer: job.developer,
        publisher: job.publisher,
        releaseDate: job.release_date,
        genres: job.genres,
        platforms: job.platforms,
        sourceSummary: job.source_summary,
      },
    }),
  });

  const rawBody = await response.text();
  let data: DescriptionResult = {};
  try {
    data = JSON.parse(rawBody) as DescriptionResult;
  } catch {
    // Preserve the HTTP status below; the truncated body is enough for logs.
  }

  if (!response.ok || data.ok === false) {
    throw new DescriptionCallError(
      response.status,
      data.error ?? (rawBody.slice(0, 500) || `Description endpoint returned ${response.status}`),
    );
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, service: "backfill-game-descriptions" }), { headers: jsonHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Supabase environment is incomplete");

    const service = createClient(supabaseUrl, serviceRoleKey);
    // A provider-wide 429 is not a bad game record. Preserve the queue, wait
    // six hours, then probe with one game rather than consuming three records.
    const [{ data: latestQuotaFailure }, { data: latestProviderSuccess }] = await Promise.all([
      service
        .from("api_usage_events")
        .select("occurred_at, error_summary")
        .eq("provider", "Google Gemini")
        .eq("service", "game-description-backfill")
        .eq("status_code", 429)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from("api_usage_events")
        .select("occurred_at")
        .eq("provider", "Google Gemini")
        .eq("service", "game-description-backfill")
        .eq("success", true)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const quotaUnresolved = Boolean(
      latestQuotaFailure
      && (!latestProviderSuccess
        || new Date(latestQuotaFailure.occurred_at) > new Date(latestProviderSuccess.occurred_at)),
    );
    if (latestQuotaFailure && quotaUnresolved) {
      const retryAfter = new Date(new Date(latestQuotaFailure.occurred_at).getTime() + 6 * 60 * 60 * 1000);
      if (retryAfter.getTime() > Date.now()) {
        await service
          .from("game_description_backfill_runs")
          .update({ next_batch_at: retryAfter.toISOString(), updated_at: new Date().toISOString() })
          .eq("status", "running");
        return new Response(JSON.stringify({
          ok: true,
          claimed: 0,
          pausedForQuota: true,
          retryAfter: retryAfter.toISOString(),
          reason: latestQuotaFailure.error_summary ?? "Gemini quota is temporarily unavailable.",
        }), { headers: jsonHeaders });
      }
    }

    const { data: claimed, error: claimError } = await service.rpc("claim_game_description_backfill_jobs", {
      p_limit: quotaUnresolved ? 1 : 3,
    });
    if (claimError) throw claimError;
    const jobs = (claimed ?? []) as BackfillJob[];

    const results = await Promise.all(jobs.map(async (job) => {
      const startedAt = Date.now();
      let success = false;
      let deferred = false;
      let wordCount: number | null = null;
      let errorMessage: string | null = null;
      try {
        const data = await invokeDescription(supabaseUrl, anonKey, job);
        success = true;
        wordCount = Number(data?.wordCount ?? String(data?.description ?? "").trim().split(/\s+/).filter(Boolean).length) || null;
      } catch (error) {
        errorMessage = describeError(error);
        if (isRetryableProviderError(error)) {
          deferred = true;
          const { error: deferError } = await service.rpc("defer_game_description_backfill_job", {
            p_job_id: job.job_id,
            p_attempt_number: job.attempt_number,
            p_error: errorMessage,
            p_retry_after_seconds: error instanceof DescriptionCallError && error.status === 429 ? 21600 : 900,
          });
          if (deferError) throw deferError;
        }
      }

      if (!deferred) {
        const { error: recordError } = await service.rpc("record_game_description_backfill_result", {
          p_job_id: job.job_id,
          p_attempt_number: job.attempt_number,
          p_success: success,
          p_word_count: wordCount,
          p_duration_ms: Date.now() - startedAt,
          p_error: errorMessage,
        });
        if (recordError) throw recordError;
      }
      return { gameId: job.game_id, name: job.name, success, deferred, wordCount, error: errorMessage };
    }));

    const runId = jobs[0]?.run_id;
    const { data: run } = runId
      ? await service.from("game_description_backfill_runs").select("*").eq("id", runId).single()
      : await service.from("game_description_backfill_runs").select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();

    return new Response(JSON.stringify({
      ok: results.every((result) => result.success || result.deferred),
      claimed: jobs.length,
      pausedForQuota: results.some((result) => result.deferred && /\b429\b|quota/i.test(result.error ?? "")),
      results,
      run,
    }), { headers: jsonHeaders });
  } catch (error) {
    console.error("Game description backfill failed", error);
    return new Response(JSON.stringify({ ok: false, error: describeError(error) }), { status: 500, headers: jsonHeaders });
  }
});
