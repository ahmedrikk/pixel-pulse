import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PANDA_BASE = "https://api.pandascore.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { path, params } = await req.json() as {
      path: string;
      params?: Record<string, string>;
    };

    const url = new URL(`${PANDA_BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const key = Deno.env.get("PANDASCORE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "PANDASCORE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
