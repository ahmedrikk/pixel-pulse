/**
 * Vercel Cron Handler — /api/cron/fetch-news
 *
 * Runs every 2 hours (configured in vercel.json).
 * Calls the Supabase Edge Function that:
 *   1. Fetches 11 gaming RSS feeds
 *   2. Runs Groq AI tag extraction on new articles
 *   3. Upserts results into cached_articles table
 *
 * Environment variables required in Vercel project settings:
 *   SUPABASE_PROJECT_ID     — e.g. zxcqqsviwtwxukizibef
 *   SUPABASE_SERVICE_KEY    — Supabase service_role secret key (NOT anon key)
 *   CRON_SECRET             — Random secret to prevent unauthorized calls
 */

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // Verify the request is coming from Vercel Cron (or an authorized caller)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const projectId = process.env.SUPABASE_PROJECT_ID;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!projectId || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing env: SUPABASE_PROJECT_ID or SUPABASE_SERVICE_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const edgeFunctionUrl = `https://${projectId}.supabase.co/functions/v1/fetch-news`;

  console.log(`[cron] Calling: ${edgeFunctionUrl}`);

  try {
    const start = Date.now();
    const res = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trigger: 'cron' }),
    });

    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => ({}));

    console.log(`[cron] Done in ${elapsed}ms — status ${res.status}`, body);

    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        elapsed_ms: elapsed,
        result: body,
      }),
      {
        status: res.ok ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[cron] fetch-news edge function call failed:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
