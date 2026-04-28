import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  correctLetter: string;
  explanation: string;
  xpReward: number;
  streakDays: number;
  totalAnswered: number;
  correctPercent: number;
  resetsAt: Date;
  userAnswer: string | null;
}

// Mock AI-generated trivia data
const INITIAL_MOCK_TRIVIA: TriviaCardData[] = [
  {
    id: "daily-1",
    type: "daily",
    category: "FPS",
    difficulty: "Medium",
    question: "Which game introduced the 'Battle Royale' genre to mainstream gaming with its 2017 launch?",
    options: [
      { letter: "A", text: "DayZ" },
      { letter: "B", text: "PUBG: Battlegrounds" },
      { letter: "C", text: "Fortnite" },
      { letter: "D", text: "H1Z1" },
    ],
    correctLetter: "B",
    explanation: "PUBG: Battlegrounds (PlayerUnknown's Battlegrounds) popularized the Battle Royale genre, bringing the 100-player last-man-standing concept to a massive global audience.",
    xpReward: 120,
    streakDays: 6,
    totalAnswered: 14820,
    correctPercent: 61,
    resetsAt: new Date(new Date().setHours(24, 0, 0, 0)),
    userAnswer: null,
  },
  {
    id: "bonus-1",
    type: "bonus",
    category: "Action RPG",
    difficulty: "Hard",
    question: "In Elden Ring, what is the name of the destined death rune?",
    options: [
      { letter: "A", text: "Rune of Death" },
      { letter: "B", text: "Miquella's Needle" },
      { letter: "C", text: "Godwyn's Seal" },
      { letter: "D", text: "Death's Poker" },
    ],
    correctLetter: "A",
    explanation: "The Rune of Death, also known as Destined Death, is the source of mortality in the Lands Between, guarded by Maliketh.",
    xpReward: 80,
    streakDays: 6,
    totalAnswered: 6240,
    correctPercent: 38,
    resetsAt: new Date(new Date().setHours(24, 0, 0, 0)),
    userAnswer: null,
  },
];

const TRIVIA_QUERY_KEY = ["trivia", "today"] as const;

// In a real app, this would be on the server
let mockTriviaCache = [...INITIAL_MOCK_TRIVIA];

export function useTrivia() {
  const queryClient = useQueryClient();

  const { data: triviaItems = [], isLoading } = useQuery({
    queryKey: TRIVIA_QUERY_KEY,
    queryFn: async () => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 200));
      return mockTriviaCache;
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ id, selectedLetter }: { id: string; selectedLetter: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const item = mockTriviaCache.find(t => t.id === id);
      if (!item) throw new Error("Trivia not found");
      if (item.userAnswer) throw new Error("Already answered");

      const isCorrect = item.correctLetter === selectedLetter;
      
      mockTriviaCache = mockTriviaCache.map(t => 
        t.id === id ? { 
          ...t, 
          userAnswer: selectedLetter,
          streakDays: isCorrect && t.type === 'daily' ? t.streakDays + 1 : t.streakDays
        } : t
      );
      
      return { 
        isCorrect, 
        correctLetter: item.correctLetter, 
        explanation: item.explanation,
        xpAwarded: isCorrect ? item.xpReward : 0 
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIVIA_QUERY_KEY });
    },
  });

  return {
    triviaItems,
    isLoading,
    answerTrivia: answerMutation.mutateAsync,
    isAnswering: answerMutation.isPending
  };
}
