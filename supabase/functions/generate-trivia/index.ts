import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

const TRIVIA_QUESTION_COUNT = 5;

interface TriviaQuestion {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  topic: string;
  generated_at?: string;
}

interface ClientQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
}

// Fix 2: Shuffle helper for randomizing question pool selection
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function generateQuestionsFromOpenRouter(): Promise<TriviaQuestion[]> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  // Fix 1: Prompt now asks for correct_answer (text) instead of correct_index (integer)
  const prompt = `Generate exactly 5 gaming trivia questions. Return ONLY a valid JSON array with no extra text, markdown, or code fences.
Each element must have exactly these fields:
- "question": a trivia question string about video games, esports, or gaming culture
- "options": an array of exactly 4 string answer choices
- "correct_answer": string (must be exactly one of the option strings)
- "topic": a short topic label (e.g. "FPS Games", "Esports History", "RPG", "Strategy Games")

Example format:
[{"question":"...","options":["a","b","c","d"],"correct_answer":"b","topic":"FPS Games"}]`;

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenRouter request failed (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  // Strip any accidental markdown code fences
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let rawQuestions: Array<{ question: string; options: string[]; correct_answer: string; topic: string }>;
  try {
    rawQuestions = JSON.parse(cleaned);
  } catch {
    throw new Error(`OpenRouter returned malformed JSON: ${content}`);
  }

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error(`OpenRouter returned unexpected structure: ${content}`);
  }

  // Validate each question has required fields
  for (const q of rawQuestions) {
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.correct_answer !== "string" ||
      typeof q.topic !== "string"
    ) {
      throw new Error(`OpenRouter returned a malformed question: ${JSON.stringify(q)}`);
    }
  }

  // Fix 1: Derive correct_index server-side by finding correct_answer in options
  const withIndex = rawQuestions.map((q) => ({
    ...q,
    correct_index: q.options.indexOf(q.correct_answer),
  }));

  // Reject questions where correct_answer doesn't match any option
  const valid = withIndex.filter((q) => q.correct_index !== -1);

  // Fix 5: Validate that OpenRouter returned enough questions
  if (valid.length < TRIVIA_QUESTION_COUNT) {
    throw new Error(`OpenRouter returned only ${valid.length} questions, expected ${TRIVIA_QUESTION_COUNT}`);
  }

  return valid as TriviaQuestion[];
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

    // Service-role client for DB writes (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const todayUtc = new Date().toISOString().slice(0, 10);

    // Step 1: Check if trivia_attempts already exists for today
    const { data: existingAttempt, error: attemptCheckError } = await supabase
      .from("trivia_attempts")
      .select("id, questions_json, answers_json, score, xp_awarded, completed_at")
      .eq("user_id", userId)
      .eq("quiz_date", todayUtc)
      .maybeSingle();

    if (attemptCheckError) {
      throw attemptCheckError;
    }

    if (existingAttempt) {
      // Strip correct_index before returning to client
      const questions: ClientQuestion[] = (existingAttempt.questions_json as TriviaQuestion[]).map(
        (q: TriviaQuestion) => ({
          id: q.id!,
          question: q.question,
          options: q.options,
          topic: q.topic,
        })
      );

      return new Response(
        JSON.stringify({
          questions,
          already_completed: existingAttempt.completed_at !== null,
        }),
        { headers: JSON_HEADERS }
      );
    }

    // Step 2: Find questions not seen by user in last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

    const { data: seenRows, error: seenError } = await supabase
      .from("trivia_user_seen")
      .select("question_id")
      .eq("user_id", userId)
      .gte("seen_at", fourteenDaysAgo);

    if (seenError) {
      throw seenError;
    }

    const seenIds = (seenRows ?? []).map((r: { question_id: string }) => r.question_id);

    // Fix 3: Only add .not() filter when there are actually seen IDs
    // Fix 2: Fetch TRIVIA_QUESTION_COUNT * 3 rows to allow shuffling
    const baseQuery = supabase
      .from("trivia_questions")
      .select("id, question, options, correct_index, topic");

    const poolQuery = seenIds.length > 0
      ? baseQuery.not("id", "in", `(${seenIds.join(",")})`)
      : baseQuery;

    const { data: pool, error: questionsError } = await poolQuery.limit(TRIVIA_QUESTION_COUNT * 3);

    if (questionsError) {
      throw questionsError;
    }

    // Fix 2: Shuffle the fetched pool before slicing
    const shuffled = shuffleArray(pool ?? []);
    let availableQuestions = shuffled.slice(0, TRIVIA_QUESTION_COUNT);

    // Step 3: If fewer than 5 available, generate new ones from OpenRouter
    let generatedQuestions: TriviaQuestion[] = [];
    if (availableQuestions.length < TRIVIA_QUESTION_COUNT) {
      try {
        generatedQuestions = await generateQuestionsFromOpenRouter();
      } catch (genErr) {
        console.error("OpenRouter generation error:", genErr);
        return new Response(
          JSON.stringify({ error: `Failed to generate trivia questions: ${String(genErr)}` }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      // Step 4: Insert new questions to trivia_questions
      const toInsert = generatedQuestions.map((q) => ({
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        topic: q.topic,
        generated_at: new Date().toISOString(),
      }));

      const { data: insertedQuestions, error: insertError } = await supabase
        .from("trivia_questions")
        .insert(toInsert)
        .select("id, question, options, correct_index, topic");

      if (insertError) {
        throw insertError;
      }

      availableQuestions = [...availableQuestions, ...(insertedQuestions ?? [])];
    }

    // Take exactly TRIVIA_QUESTION_COUNT questions
    const selectedQuestions = availableQuestions.slice(0, TRIVIA_QUESTION_COUNT);

    // Step 5: Create trivia_attempts row with questions_json (including correct_index, server-side only)
    const questionsJson = selectedQuestions.map((q: TriviaQuestion & { id: string }) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      topic: q.topic,
    }));

    const { error: createAttemptError } = await supabase
      .from("trivia_attempts")
      .insert({
        user_id: userId,
        quiz_date: todayUtc,
        questions_json: questionsJson,
        answers_json: null,
        score: null,
        xp_awarded: null,
        completed_at: null,
      });

    if (createAttemptError) {
      // 23505 = unique_violation: concurrent request already created the attempt
      if (createAttemptError.code === "23505") {
        // Fetch the concurrently-created attempt and return it
        const { data: racedAttempt, error: raceFetchError } = await supabase
          .from("trivia_attempts")
          .select("questions_json, completed_at")
          .eq("user_id", userId)
          .eq("quiz_date", todayUtc)
          .single();

        if (raceFetchError) throw raceFetchError;

        const questions: ClientQuestion[] = (racedAttempt.questions_json as TriviaQuestion[]).map(
          (q: TriviaQuestion) => ({
            id: q.id!,
            question: q.question,
            options: q.options,
            topic: q.topic,
          })
        );

        return new Response(
          JSON.stringify({
            questions,
            already_completed: racedAttempt.completed_at !== null,
          }),
          { headers: JSON_HEADERS }
        );
      }
      throw createAttemptError;
    }

    // Step 6: Track question IDs in trivia_user_seen
    const seenInserts = selectedQuestions.map((q: { id: string }) => ({
      user_id: userId,
      question_id: q.id,
      seen_at: new Date().toISOString(),
    }));

    // Fix 4: Make trivia_user_seen insert failure non-silent (throw instead of log)
    const { error: seenInsertError } = await supabase
      .from("trivia_user_seen")
      .upsert(seenInserts, { onConflict: "user_id,question_id" });

    if (seenInsertError) throw seenInsertError;

    // Step 7: Return questions without correct_index
    const clientQuestions: ClientQuestion[] = selectedQuestions.map(
      (q: TriviaQuestion & { id: string }) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        topic: q.topic,
      })
    );

    return new Response(
      JSON.stringify({
        questions: clientQuestions,
        already_completed: false,
      }),
      { headers: JSON_HEADERS }
    );

  } catch (err) {
    console.error("generate-trivia error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
});
