import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: admin-only via x-admin-key header
    const adminKey = req.headers.get("x-admin-key");
    if (!adminKey || adminKey !== Deno.env.get("ADMIN_SECRET_KEY")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: JSON_HEADERS,
      });
    }

    // Parse and validate input
    const body = await req.json();
    const { match_id, winning_team, cancelled } = body;

    if (typeof match_id !== "number") {
      return new Response(
        JSON.stringify({ error: "match_id must be a number" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Service-role client for all DB operations (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch all unresolved predictions for this match
    const { data: predictions, error: fetchError } = await supabase
      .from("predictions")
      .select("id, user_id, predicted_team, xp_participation, xp_bonus")
      .eq("match_id", match_id)
      .is("resolved_at", null);

    if (fetchError) throw fetchError;

    if (!predictions || predictions.length === 0) {
      return new Response(JSON.stringify({ resolved: 0 }), {
        headers: JSON_HEADERS,
      });
    }

    const now = new Date().toISOString();
    const correctUserIds: string[] = [];

    // 2. Process each prediction
    for (const pred of predictions) {
      const isCorrect = cancelled
        ? null
        : pred.predicted_team === winning_team;

      // Mark prediction as resolved
      const { error: updateError } = await supabase
        .from("predictions")
        .update({ is_correct: isCorrect, resolved_at: now })
        .eq("id", pred.id);

      if (updateError) throw updateError;

      if (cancelled && pred.xp_participation > 0) {
        // Refund participation XP via increment_xp RPC (negative delta)
        const delta = -pred.xp_participation;
        const { error: rpcError } = await supabase.rpc("increment_xp", {
          uid: pred.user_id,
          delta_today: delta,
          delta_season: delta,
          delta_lifetime: delta,
        });
        if (rpcError) throw rpcError;

        // Insert refund row in xp_events
        const { error: refundEventError } = await supabase
          .from("xp_events")
          .insert({
            user_id: pred.user_id,
            action_type: "predict_submit_refund",
            ref_id: String(match_id),
            xp_awarded: delta,
            multiplier_applied: 1,
          });
        if (refundEventError) throw refundEventError;
      } else if (isCorrect === true) {
        // Collect user IDs for correct predictors to award XP in parallel
        correctUserIds.push(pred.user_id);
      }
    }

    // 3. Parallelize award-xp calls for all correct predictors
    if (correctUserIds.length > 0) {
      await Promise.all(
        correctUserIds.map(async (userId) => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/award-xp`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action_type: "predict_correct",
                ref_id: String(match_id),
                _user_override: userId,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              console.error(
                `award-xp failed for user ${userId}: ${res.status} ${errText}`
              );
            }
          } catch (err) {
            // Non-fatal: log and continue
            console.error(`award-xp error for user ${userId}:`, err);
          }
        })
      );
    }

    return new Response(
      JSON.stringify({ resolved: predictions.length }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error("resolve-predictions error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
