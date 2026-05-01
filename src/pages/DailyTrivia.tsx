import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Trophy, Brain, Zap, CheckCircle, XCircle, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getTodayTrivia, submitTrivia } from "@/lib/xpService";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  topic: string;
}

const QUESTION_TIME_LIMIT = 30; // 30 seconds per question
const TOTAL_QUESTIONS = 3;

export default function DailyTrivia() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIME_LIMIT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    score: number;
    xp_awarded: number;
    correct_answers: boolean[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // Fetch trivia questions
  useEffect(() => {
    async function loadTrivia() {
      const data = await getTodayTrivia();
      if (data?.already_completed) {
        setAlreadyCompleted(true);
      } else if (data?.questions) {
        // Shuffle options for each question
        const shuffledQuestions = data.questions.slice(0, TOTAL_QUESTIONS).map(q => ({
          ...q,
          options: shuffleArray([...q.options]),
        }));
        setQuestions(shuffledQuestions);
      }
      setLoading(false);
    }
    loadTrivia();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (showResults || isSubmitting || answers.length > currentIndex) return;
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-submit on timeout
          handleAnswer(-1);
          return QUESTION_TIME_LIMIT;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, answers, showResults, isSubmitting]);

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const handleAnswer = useCallback(async (answerIndex: number) => {
    if (isSubmitting) return;

    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (newAnswers.length >= Math.min(questions.length, TOTAL_QUESTIONS)) {
      // Submit trivia
      setIsSubmitting(true);
      const result = await submitTrivia(newAnswers);
      
      if (result) {
        setResults({
          score: result.score,
          xp_awarded: result.xp_awarded,
          correct_answers: result.results.map(r => r.correct),
        });
        setShowResults(true);
        
        if (result.xp_awarded > 0) {
          toast.success(`+${result.xp_awarded} XP earned!`, {
            description: `You got ${result.score}/${result.total} correct`,
          });
        }
      }
      setIsSubmitting(false);
    } else {
      setCurrentIndex(newAnswers.length);
      setTimeRemaining(QUESTION_TIME_LIMIT);
    }
  }, [answers, questions.length, isSubmitting]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading trivia...</p>
        </div>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-nav backdrop-blur-sm">
          <div className="container flex h-14 items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-bold text-xl">Daily Trivia</h1>
          </div>
        </header>
        
        <main className="container py-12 max-w-md">
          <Card className="text-center p-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Already Completed!</h2>
            <p className="text-muted-foreground mb-6">
              You've already completed today's trivia. Come back tomorrow for more XP!
            </p>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </Card>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / Math.min(questions.length, TOTAL_QUESTIONS)) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-nav backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold">Daily Trivia</h1>
            <p className="text-xs text-muted-foreground">
              Question {currentIndex + 1} of {Math.min(questions.length, TOTAL_QUESTIONS)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span>Up to 155 XP</span>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-2xl">
        {/* Progress */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          {!showResults && currentQuestion ? (
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Timer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  <span className="capitalize">{currentQuestion.topic}</span>
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  timeRemaining <= 10 && "text-destructive"
                )}>
                  <Timer className="h-4 w-4" />
                  <span>{timeRemaining}s</span>
                </div>
              </div>

              {/* Question */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold leading-relaxed">
                    {currentQuestion.question}
                  </h2>
                </CardContent>
              </Card>

              {/* Timer Bar */}
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    timeRemaining <= 10 ? "bg-destructive" : "bg-primary"
                  )}
                  initial={{ width: "100%" }}
                  animate={{ width: `${(timeRemaining / QUESTION_TIME_LIMIT) * 100}%` }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </div>

              {/* Options */}
              <div className="grid gap-3">
                {currentQuestion.options.map((option, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnswer(index)}
                    disabled={isSubmitting}
                    className="w-full p-4 text-left rounded-xl border bg-card hover:bg-accent hover:border-primary/30 transition-all text-sm font-medium"
                  >
                    {option}
                  </motion.button>
                ))}
              </div>

              {/* XP Info */}
              <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  10 XP per correct
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  75 XP perfect bonus
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  50 XP speed bonus
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Results */}
              <Card className="text-center p-8">
                <div className="mb-6">
                  {results && results.score === TOTAL_QUESTIONS ? (
                    <Trophy className="h-16 w-16 text-yellow-500 mx-auto" />
                  ) : results && results.score >= 2 ? (
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                  ) : (
                    <Brain className="h-16 w-16 text-primary mx-auto" />
                  )}
                </div>
                
                <h2 className="text-3xl font-bold mb-2">
                  {results?.score}/{TOTAL_QUESTIONS} Correct!
                </h2>
                <p className="text-muted-foreground mb-6">
                  {results?.score === TOTAL_QUESTIONS
                    ? "Perfect score! You're a gaming genius!"
                    : results && results.score >= 2
                    ? "Great job! Almost perfect!"
                    : "Good effort! Try again tomorrow!"}
                </p>

                <div className="flex justify-center items-center gap-2 text-2xl font-bold text-primary mb-6">
                  <Zap className="h-6 w-6" />
                  +{results?.xp_awarded} XP
                </div>

                <Button onClick={() => navigate(-1)} className="w-full">
                  Continue
                </Button>
              </Card>

              {/* Answer Breakdown */}
              <div className="space-y-3">
                <h3 className="font-semibold">Answer Breakdown</h3>
                {questions.slice(0, TOTAL_QUESTIONS).map((q, idx) => (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-start gap-3">
                      {results?.correct_answers[idx] ? (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-medium mb-1">{q.question}</p>
                        <p className="text-xs text-muted-foreground">
                          Your answer: {q.options[answers[idx]] || "Time's up"}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    <Footer />
    </div>
  );
}

import { cn } from "@/lib/utils";
