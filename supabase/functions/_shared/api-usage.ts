export interface ApiUsageEvent {
  provider: string;
  service: string;
  model?: string | null;
  operation: string;
  success: boolean;
  statusCode?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  cachedTokens?: number | null;
  quotaUnits?: number | null;
  latencyMs: number;
  errorSummary?: string | null;
}

/**
 * Best-effort operational accounting. Usage logging must never break the
 * product workflow it observes, and it never stores prompts or credentials.
 */
export async function recordApiUsage(event: ApiUsageEvent): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/api_usage_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        provider: event.provider,
        service: event.service,
        model: event.model ?? null,
        operation: event.operation,
        success: event.success,
        status_code: event.statusCode ?? null,
        prompt_tokens: event.promptTokens ?? null,
        completion_tokens: event.completionTokens ?? null,
        total_tokens: event.totalTokens ?? null,
        cached_tokens: event.cachedTokens ?? null,
        quota_units: event.quotaUnits ?? null,
        latency_ms: Math.max(0, Math.round(event.latencyMs)),
        error_summary: event.errorSummary?.slice(0, 300) ?? null,
      }),
    });
  } catch {
    // Accounting is deliberately non-fatal.
  }
}
