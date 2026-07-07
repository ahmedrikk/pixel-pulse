/**
 * Vercel Cron Handler — /api/cron/compute-trending
 *
 * Runs every hour (configured in vercel.json).
 * Calls the Supabase Edge Function that:
 *   1. Aggregates news mentions from cached_articles.game_tags
 *   2. Fetches Steam player counts, Twitch top-games rank, and PandaScore matches
 *   3. Blends community + RAWG + news + Steam + Twitch + esports into composite scores
 *   4. Upserts results into trending_scores table
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

  const edgeFunctionUrl = `https://${projectId}.supabase.co/functions/v1/compute-trending`;

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
    console.error('[cron] compute-trending edge function call failed:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
