import { useState } from "react";
import { Zap, Users, HelpCircle, ExternalLink, Radio, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRIENDS_ONLINE, TRIVIA_QUESTION } from "@/data/mockNews";
import { useEsportsScores } from "@/hooks/useEsportsScores";
import { formatMatchScore } from "@/lib/pandascore";
import { formatDistanceToNow } from "date-fns";

const GAME_COLORS: Record<string, string> = {
  CS2: "bg-yellow-500/20 text-yellow-400",
  LoL: "bg-blue-500/20 text-blue-400",
  Valorant: "bg-red-500/20 text-red-400",
  "Dota 2": "bg-purple-500/20 text-purple-400",
  OW2: "bg-orange-500/20 text-orange-400",
  R6: "bg-green-500/20 text-green-400",
};

function GameBadge({ label }: { label: string }) {
  const color = GAME_COLORS[label] ?? "bg-primary/20 text-primary";
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>
      {label}
    </span>
  );
}

function LiveMatchesSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-2 animate-pulse">
          <div className="h-3 bg-secondary rounded w-1/3" />
          <div className="h-4 bg-secondary rounded w-3/4" />
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { liveMatches, upcomingMatches, isLiveLoading, isUpcomingLoading, liveError, upcomingError } =
    useEsportsScores();

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowResult(true);
  };

  const displayedLive = liveMatches.slice(0, 3);
  const displayedUpcoming = upcomingMatches.slice(0, 3);

  return (
    <aside className="w-full lg:w-72 space-y-4">

      {/* Live Matches Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-destructive/20 to-primary/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-destructive animate-pulse" />
            <h3 className="font-semibold">Live Matches</h3>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
              <span className="px-2 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full font-medium">
                LIVE
              </span>
            </span>
          </div>
        </div>

        {isLiveLoading ? (
          <LiveMatchesSkeleton />
        ) : liveError ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Could not load live matches
          </div>
        ) : displayedLive.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No live matches right now
          </div>
        ) : (
          <div className="divide-y">
            {displayedLive.map((match) => (
              <div key={match.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GameBadge label={match.gameLabel} />
                  <span className="text-xs text-muted-foreground truncate">
                    {match.tournament}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium truncate flex-1">
                    {match.team1}
                  </span>
                  <span className="text-sm font-bold text-primary shrink-0 px-2">
                    {formatMatchScore(match.score1, match.score2)}
                  </span>
                  <span className="text-sm font-medium truncate flex-1 text-right">
                    {match.team2}
                  </span>
                </div>
                {match.streamUrl && (
                  <Button asChild size="sm" className="w-full gap-2 h-7 text-xs">
                    <a
                      href={match.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Watch Live
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Matches Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            <h3 className="font-semibold">Upcoming</h3>
          </div>
        </div>

        {isUpcomingLoading ? (
          <LiveMatchesSkeleton />
        ) : upcomingError ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Could not load upcoming matches
          </div>
        ) : displayedUpcoming.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No upcoming matches scheduled
          </div>
        ) : (
          <div className="divide-y">
            {displayedUpcoming.map((match) => (
              <div key={match.id} className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <GameBadge label={match.gameLabel} />
                  <span className="text-xs text-muted-foreground truncate">
                    {match.tournament}
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {match.team1} vs {match.team2}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {match.begin_at
                    ? `Starts ${formatDistanceToNow(new Date(match.begin_at), { addSuffix: true })}`
                    : "Time TBD"}
                </p>
              </div>
            ))}
          </div>
        )}
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
        <p className="text-xs text-muted-foreground mt-3 text-center" aria-live="polite">
          {showResult ? (
            selectedAnswer === TRIVIA_QUESTION.correctAnswer
              ? "🎉 Correct! +10 XP"
              : "❌ Nice try! Check back tomorrow."
          ) : null}
        </p>
      </div>
    </aside>
  );
}
