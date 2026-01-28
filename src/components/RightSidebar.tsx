import { useState } from "react";
import { Zap, Users, HelpCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRIENDS_ONLINE, TRIVIA_QUESTION } from "@/data/mockNews";

export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowResult(true);
  };

  return (
    <aside className="w-full lg:w-72 space-y-4">
      {/* Live Events */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            <h3 className="font-semibold">Live Event</h3>
            <span className="ml-auto px-2 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full font-medium">
              LIVE
            </span>
          </div>
        </div>
        <div className="p-4">
          <h4 className="font-bold mb-1">Valorant Champions Tour</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Grand Finals: Sentinels vs. Fnatic
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Users className="h-4 w-4" />
            <span>124,521 watching</span>
          </div>
          <Button className="w-full gap-2">
            Join Stream
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Friends Online */}
      <div className="bg-card rounded-lg border p-4 card-shadow">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Friends Online
        </h3>
        <div className="space-y-3">
          {FRIENDS_ONLINE.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                  {friend.name.slice(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    friend.status === "online"
                      ? "bg-online"
                      : friend.status === "away"
                      ? "bg-yellow-500"
                      : "bg-muted-foreground"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{friend.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {friend.game}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gaming Trivia */}
      <div className="bg-card rounded-lg border p-4 card-shadow sticky top-20">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-accent" />
          Daily Trivia
        </h3>
        <p className="text-sm mb-4">{TRIVIA_QUESTION.question}</p>
        <div className="space-y-2">
          {TRIVIA_QUESTION.options.map((option, index) => {
            const isCorrect = index === TRIVIA_QUESTION.correctAnswer;
            const isSelected = selectedAnswer === index;

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showResult}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  showResult
                    ? isCorrect
                      ? "bg-online/20 text-online border border-online"
                      : isSelected
                      ? "bg-destructive/20 text-destructive border border-destructive"
                      : "bg-secondary text-muted-foreground"
                    : "bg-secondary hover:bg-tag hover:text-tag-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {showResult && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {selectedAnswer === TRIVIA_QUESTION.correctAnswer
              ? "🎉 Correct! +10 XP"
              : "❌ Nice try! Check back tomorrow."}
          </p>
        )}
      </div>
    </aside>
  );
}
