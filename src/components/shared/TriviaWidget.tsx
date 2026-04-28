import { useState } from "react";
import { HelpCircle, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { toast } from "sonner";
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
  const { addXP } = useXP();
  const { triviaItems, isLoading, answerTrivia } = useTrivia();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use the daily question for the widget
  const dailyData = triviaItems.find(t => t.type === "daily");

  if (isLoading || !dailyData) {
    return (
      <Card className="animate-pulse border-border/40">
        <CardContent className="p-4 h-48 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const revealed = !!dailyData.userAnswer;
  const selectedLetter = dailyData.userAnswer;

  const handleAnswer = async (letter: string) => {
    if (revealed || isSubmitting) return;
    if (!isAuthenticated) {
      openAuthModal("trivia_answer" as never);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await answerTrivia({ id: dailyData.id, selectedLetter: letter });
      if (result.isCorrect) {
        addXP(result.xpAwarded);
        toast.success(`+${result.xpAwarded} XP earned! 🎉`, { description: "Correct answer!" });
      } else {
        toast.error("Incorrect! Better luck tomorrow.", { description: `The answer was ${result.correctLetter}.` });
      }
    } catch (error) {
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOptionStyle = (letter: string) => {
    if (!revealed) return "border-border bg-card text-muted-foreground hover:bg-secondary/50";
    if (letter === dailyData.correctLetter) return "border-[#16A34A] bg-[#EAF3DE] text-[#16A34A] font-medium";
    if (letter === selectedLetter) return "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]";
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
        <div className="flex items-center gap-1 bg-accent/10 text-accent px-2 py-0.5 rounded text-xs font-medium border border-accent/20">
          <Zap className="w-3 h-3" />
          +{dailyData.xpReward} XP
        </div>
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
                revealed && opt.letter === dailyData.correctLetter ? "bg-[#16A34A] text-white" :
                revealed && opt.letter === selectedLetter ? "bg-[#DC2626] text-white" :
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
