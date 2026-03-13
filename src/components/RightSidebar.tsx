import { useState } from "react";
import { Zap, Users, HelpCircle, ExternalLink, Radio, Trophy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRIENDS_ONLINE, TRIVIA_QUESTION, LIVE_MATCH } from "@/data/mockNews";

const TOP_PLAYERS = [
  { rank: 1, username: "ShadowReaper", xp: 12450 },
  { rank: 2, username: "NeonBlade", xp: 11200 },
  { rank: 3, username: "PixelStorm", xp: 9870 },
  { rank: 4, username: "VoidWalker", xp: 8540 },
  { rank: 5, username: "CyberNinja", xp: 7320 },
  { rank: 6, username: "IronPhoenix", xp: 6100 },
  { rank: 7, username: "GhostFury", xp: 5480 },
  { rank: 8, username: "ArcticWolf", xp: 4950 },
  { rank: 9, username: "BlazeMaster", xp: 4200 },
  { rank: 10, username: "TitanX", xp: 3750 },
];


export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowResult(true);
  };

  return (
    <aside className="w-full lg:w-72 space-y-4">
      {/* Esports Widget */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        {/* Live Now Section */}
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
        <div className="p-4 border-b">
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

        {/* Upcoming Event Section */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-3 border-b">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            <h3 className="font-semibold text-sm">Upcoming Event</h3>
          </div>
        </div>
        <div className="p-4 border-b">
          <h4 className="font-bold mb-1">League of Legends Worlds</h4>
          <p className="text-sm text-muted-foreground mb-2">
            Semifinals: T1 vs. Gen.G
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>🕐 Starts in 2 hours</span>
          </div>
        </div>

        {/* Full Schedule Button */}
        <div className="p-3">
          <Button variant="secondary" asChild className="w-full gap-2">
            <a href="/esports">
              Check Full Schedule
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* XP Leaderboard */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-yellow-500/15 to-primary/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Top Players</h3>
          </div>
        </div>
        <div className="p-3 space-y-1">
          {TOP_PLAYERS.map((player) => (
            <div
              key={player.rank}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors ${
                player.rank <= 3 ? "bg-secondary/60" : "hover:bg-secondary/40"
              }`}
            >
              <span className={`w-5 text-center text-xs font-bold ${
                player.rank === 1 ? "text-yellow-500" :
                player.rank === 2 ? "text-muted-foreground" :
                player.rank === 3 ? "text-orange-400" :
                "text-muted-foreground"
              }`}>
                {player.rank <= 3 ? (
                  <Crown className={`h-3.5 w-3.5 mx-auto ${
                    player.rank === 1 ? "text-yellow-500" :
                    player.rank === 2 ? "text-muted-foreground" :
                    "text-orange-400"
                  }`} />
                ) : player.rank}
              </span>
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                {player.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-medium truncate">{player.username}</span>
              <span className="text-xs text-muted-foreground font-mono">{player.xp.toLocaleString()}</span>
            </div>
          ))}
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
