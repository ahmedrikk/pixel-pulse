import { useQuery } from "@tanstack/react-query";
import { getTodayTrivia } from "@/lib/xpService";

export interface TriviaOption {
  letter: string;
  text: string;
}

export interface TriviaCardData {
  id: string;
  type: "daily" | "bonus";
  category: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  question: string;
  options: TriviaOption[];
  correctLetter: string | null;
  explanation: string;
  xpReward: number;
  streakDays: number;
  totalAnswered: number;
  correctPercent: number;
  resetsAt: Date;
  userAnswer: string | null;
}

const TRIVIA_QUERY_KEY = ["trivia", "today"] as const;
const LETTERS = ["A", "B", "C", "D"];

/**
 * Loads the active AI-generated trivia set from the server. Questions are
 * persisted in Supabase and carry their own 24-hour expiration timestamp.
 * Correct answers remain server-side; Hub cards link into the scored quiz.
 */
export function useTrivia() {
  const { data: triviaItems = [], isLoading, error } = useQuery({
    queryKey: TRIVIA_QUERY_KEY,
    queryFn: async (): Promise<TriviaCardData[]> => {
      const result = await getTodayTrivia();
      if (!result) throw new Error("Today's trivia is unavailable");

      return result.questions.slice(0, 2).map((question, index) => ({
        id: question.id,
        type: index === 0 ? "daily" : "bonus",
        category: question.topic || "Gaming",
        difficulty: question.difficulty ?? (index === 0 ? "Medium" : "Hard"),
        question: question.question,
        options: question.options.map((text, optionIndex) => ({
          letter: LETTERS[optionIndex] ?? String(optionIndex + 1),
          text,
        })),
        correctLetter: null,
        explanation: "",
        xpReward: 15,
        streakDays: 0,
        totalAnswered: 0,
        correctPercent: 0,
        resetsAt: new Date(question.expires_at),
        userAnswer: null,
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    triviaItems,
    isLoading,
    error,
  };
}
