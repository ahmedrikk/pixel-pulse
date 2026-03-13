import { useState } from "react";
import { Zap, Users, HelpCircle, ExternalLink, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRIENDS_ONLINE, TRIVIA_QUESTION, LIVE_MATCH } from "@/data/mockNews";


export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowResult(true);
  };

  return (
    <aside className="w-full lg:w-72 space-y-4">
      {/* Live Match Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-destructive/20 to-primary/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive animate-pulse" />
            <h3 className="font-semibold">Live Now</h3>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
              <span className="px-2 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full font-medium">
                LIVE
              </span>
            </span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            {LIVE_MATCH.tournamentName}
          </p>
          <h4 className="font-bold text-lg mb-2">{LIVE_MATCH.matchTitle}</h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Users className="h-4 w-4" />
            <span>{LIVE_MATCH.viewers} watching</span>
          </div>
          <Button asChild className="w-full gap-2">
            <a href={LIVE_MATCH.streamUrl} target="_blank" rel="noopener noreferrer">
              Watch on {LIVE_MATCH.platform}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Battle Pass Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Battle Pass</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
              <span className="text-lg font-black text-primary">{state.level}</span>
            </div>
            <div>
              <p className="text-sm font-bold">Level {state.level}</p>
              <p className="text-xs text-muted-foreground">Season of the Seraph</p>
            </div>
          </div>
          <div className="relative h-2 w-full rounded-full bg-secondary/60 overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${bpProgress}%`,
                background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {state.currentLevelXP} / {state.xpForNextLevel} XP to next level
          </p>
          <Button asChild variant="secondary" className="w-full gap-2">
            <Link to="/battle-pass">
              Explore Battle Pass
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Live Events */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            <h3 className="font-semibold">Upcoming Event</h3>
          </div>
        </div>
        <div className="p-4">
          <h4 className="font-bold mb-1">League of Legends Worlds</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Semifinals: T1 vs. Gen.G
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <span>🕐 Starts in 2 hours</span>
          </div>
          <Button variant="secondary" className="w-full gap-2">
            Set Reminder
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
      <div className="bg-card rounded-lg border p-4 card-shadow">
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
