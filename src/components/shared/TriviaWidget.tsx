import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useTrivia } from "@/hooks/useTrivia";

function getTimeRemaining(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "0h 0m";
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hrs}h ${mins}m`;
}

export function TriviaWidget() {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { triviaItems, isLoading, error } = useTrivia();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use the daily question for the widget
  const dailyData = triviaItems.find(t => t.type === "daily");

  if (isLoading) {
    return (
      <Card className="animate-pulse border-border/40">
        <CardContent className="p-4 h-48 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error || !dailyData) {
    return (
      <Card className="border-border/40">
        <CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Today’s trivia has not been generated yet.</p>
        </CardContent>
      </Card>
    );
  }

  const revealed = !!dailyData.userAnswer;
  const selectedLetter = dailyData.userAnswer;

  const handleAnswer = (_letter: string) => {
    if (revealed || isSubmitting) return;
    if (!isAuthenticated) {
      openAuthModal("trivia_answer");
      return;
    }
    
    setIsSubmitting(true);
    navigate("/trivia");
  };

  const getOptionStyle = (letter: string) => {
    if (!revealed) return "border-border bg-card text-muted-foreground hover:bg-secondary/50";
    if (letter === dailyData.correctLetter) return "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium";
    if (letter === selectedLetter) return "border-destructive/60 bg-destructive/10 text-destructive";
    return "border-border bg-card text-muted-foreground opacity-50";
  };

  return (
    <Card className="border border-border/50 bg-card card-shadow overflow-hidden group transition-colors hover:border-primary/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent/10 to-transparent p-3.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔮</span>
          <h3 className="font-semibold text-sm">Daily trivia</h3>
        </div>
        <span className="text-xs text-muted-foreground">Daily challenge</span>
      </div>

      <CardContent className="p-3.5 pt-4">
        <p className="text-[13px] font-medium leading-relaxed mb-4 text-foreground/90">
          {dailyData.question}
        </p>

        <div className="space-y-2 mb-4">
          {dailyData.options.map((opt) => (
            <button
              key={opt.letter}
              onClick={() => handleAnswer(opt.letter)}
              disabled={revealed || isSubmitting}
              className={`w-full flex items-center gap-2.5 p-2 rounded-md border text-[11px] text-left transition-all ${getOptionStyle(opt.letter)} ${(!revealed && !isSubmitting) ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 transition-colors ${
                revealed && opt.letter === dailyData.correctLetter ? "bg-emerald-500 text-white" :
                revealed && opt.letter === selectedLetter ? "bg-destructive text-white" :
                "bg-secondary border border-border"
              }`}>
                {revealed && opt.letter === dailyData.correctLetter ? "✓" :
                 revealed && opt.letter === selectedLetter ? "✗" : ""}
              </div>
              <span className="flex-1 truncate"><span className="font-medium opacity-60 mr-1.5">{opt.letter}</span>{opt.text}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-3 border-t border-border/50">
          <span>Resets in {getTimeRemaining(dailyData.resetsAt)}</span>
          <span className="flex items-center gap-1 font-medium text-amber-500">
            🔥 {dailyData.streakDays} streak
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
