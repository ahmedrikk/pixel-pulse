import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

interface StoredQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  topic: string;
}

interface AwardXpResult {
  awarded: number;
  duplicate?: boolean;
  capped?: boolean;
  xp_today?: number;
}

async function callAwardXp(
  supabaseUrl: string,
  authHeader: string,
  actionType: string,
  refId: string
): Promise<number> {
  const url = `${supabaseUrl}/functions/v1/award-xp`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action_type: actionType, ref_id: refId }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`award-xp call failed for ${actionType} (${resp.status}): ${errText}`);
    // Non-fatal: return 0 so we don't block the trivia completion
    return 0;
  }

  try {
    const result: AwardXpResult = await resp.json();
    return result.awarded ?? 0;
  } catch {
    console.error(`award-xp returned non-JSON body for ${actionType}`);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: require user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: JSON_HEADERS,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user JWT via anon client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: JSON_HEADERS,
      });
    }

    const userId = user.id;

    // Parse and validate request body
    let body: { answers?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: JSON_HEADERS,
      });
    }

    const { answers } = body;
    if (!Array.isArray(answers) || answers.some((a) => typeof a !== "number")) {
      return new Response(
        JSON.stringify({ error: "answers must be an array of numbers" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (!answers.every((a: number) => Number.isInteger(a) && a >= 0 && a <= 3)) {
      return new Response(JSON.stringify({ error: "Each answer must be an integer 0-3" }), {
        status: 400, headers: JSON_HEADERS,
      });
    }

    const answersList = answers as number[];

    // Service-role client for DB writes (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const todayUtc = new Date().toISOString().slice(0, 10);

    // Step 1: Load today's trivia_attempts row
    const { data: attempt, error: attemptError } = await supabase
      .from("trivia_attempts")
      .select("id, questions_json, answers_json, completed_at")
      .eq("user_id", userId)
      .eq("quiz_date", todayUtc)
      .maybeSingle();

    if (attemptError) {
      throw attemptError;
    }

    if (!attempt) {
      return new Response(
        JSON.stringify({ error: "No trivia attempt found for today. Call generate-trivia first." }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    if (attempt.completed_at !== null) {
      return new Response(
        JSON.stringify({ error: "Trivia already completed for today." }),
        { status: 409, headers: JSON_HEADERS }
      );
    }

    const questions = attempt.questions_json as StoredQuestion[];

    if (answersList.length !== questions.length) {
      return new Response(
        JSON.stringify({
          error: `Expected ${questions.length} answers, got ${answersList.length}`,
        }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Step 2: Score the answers against questions_json.correct_index
    const results = questions.map((q, i) => ({
      correct: answersList[i] === q.correct_index,
      correct_index: q.correct_index,
    }));

    const score = results.filter((r) => r.correct).length;
    const isPerfect = score === questions.length;

    // Mark attempt complete BEFORE awarding XP — prevents double-XP if the process restarts mid-flight
    const { error: updateError } = await supabase
      .from("trivia_attempts")
      .update({
        answers_json: answersList,
        score,
        completed_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);

    if (updateError) {
      throw updateError;
    }

    // Step 3: Award XP for trivia performance — calls are parallelized via Promise.all
    const xpCalls: Promise<number>[] = [callAwardXp(supabaseUrl, authHeader, "trivia_participate", todayUtc)];

    for (let i = 0; i < questions.length; i++) {
      if (results[i].correct) {
        xpCalls.push(callAwardXp(supabaseUrl, authHeader, "trivia_correct", `${todayUtc}-q${i}`));
      }
    }

    if (isPerfect) {
      xpCalls.push(callAwardXp(supabaseUrl, authHeader, "trivia_perfect", todayUtc));
    }

    const xpResults = await Promise.all(xpCalls);
    const totalXpAwarded = xpResults.reduce((a, b) => a + b, 0);

    // Step 4: Persist xp_awarded total after collecting results from parallel XP calls
    const { error: xpUpdateError } = await supabase
      .from("trivia_attempts")
      .update({ xp_awarded: totalXpAwarded })
      .eq("id", attempt.id);

    if (xpUpdateError) {
      throw xpUpdateError;
    }

    // Step 5: Return score, results, and XP summary
    return new Response(
      JSON.stringify({
        score,
        total: questions.length,
        xp_awarded: totalXpAwarded,
        results,
      }),
      { headers: JSON_HEADERS }
    );

  } catch (err) {
    console.error("submit-trivia error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
});
