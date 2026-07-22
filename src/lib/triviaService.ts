import { isDemoMode, supabase } from "@/integrations/supabase/client";

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
  difficulty?: "Easy" | "Medium" | "Hard" | "Expert";
  expires_at: string;
}

export interface TriviaSet {
  questions: TriviaQuestion[];
  already_completed: boolean;
}

/**
 * Signed-in players go through the Edge Function so their daily attempt is
 * persisted. Guests read the active question preview directly through the
 * table's public read policy; this avoids requiring a JWT for a read-only card.
 */
export async function getTodayTrivia(): Promise<TriviaSet | null> {
  if (isDemoMode()) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data, error } = await supabase.functions.invoke("generate-trivia", { body: {} });
    if (error) {
      console.error("Trivia fetch failed:", error);
      return null;
    }
    return data as TriviaSet;
  }

  const { data, error } = await supabase
    .from("trivia_questions")
    .select("id, question, options, topic, difficulty, expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("generated_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Trivia preview fetch failed:", error);
    return null;
  }

  const questions: TriviaQuestion[] = (data ?? []).map((row) => ({
    id: row.id,
    question: row.question,
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    topic: row.topic,
    difficulty: row.difficulty as TriviaQuestion["difficulty"],
    expires_at: row.expires_at,
  }));

  return questions.length > 0
    ? { questions, already_completed: false }
    : null;
}

export async function submitTrivia(
  answers: number[],
): Promise<{
  score: number;
  total: number;
  results: { correct: boolean; correct_index: number }[];
} | null> {
  if (isDemoMode()) return null;

  const { data, error } = await supabase.functions.invoke("submit-trivia", {
    body: { answers },
  });
  if (error) {
    console.error("Trivia submit failed:", error);
    return null;
  }
  return data;
}
