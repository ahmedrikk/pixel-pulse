import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Users, HelpCircle, ExternalLink, Radio, Trophy, Target, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PredictionCard } from "./PredictionCard";
import { Card, CardContent } from "@/components/ui/card";
import { TriviaWidget } from "@/components/shared/TriviaWidget";
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import type { EsportsMatch as PandaMatch } from "@/lib/pandascore";

// Adapter: convert PandaScore EsportsMatch to the shape PredictionCard expects
function toPredictionMatch(m: PandaMatch) {
  return {
    id: String(m.id),
    gameTitle: m.game,
    leagueName: m.league,
    format: m.numberOfGames ? `Bo${m.numberOfGames}` : "Match",
    teamA: { name: m.team1, logo: "🎮", shortName: m.team1.slice(0, 3).toUpperCase(), flag: "", probability: 50 },
    teamB: { name: m.team2, logo: "🎮", shortName: m.team2.slice(0, 3).toUpperCase(), flag: "", probability: 50 },
    scoreA: m.score1,
    scoreB: m.score2,
    timestamp: m.begin_at ?? new Date().toISOString(),
    status: (m.status === "running" ? "live" : m.status === "finished" ? "completed" : "upcoming") as "live" | "upcoming" | "completed",
    streamUrl: m.streamUrl ?? undefined,
  };
}


export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const { liveMatches, upcomingMatches } = useEsportsMatches();
  const liveMatch = liveMatches[0] ?? null;
  const showUpcoming = upcomingMatches.slice(0, 2).map(toPredictionMatch);

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useLeaderboard();

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowResult(true);
  };

  return (
    <aside className="w-full lg:w-72 space-y-4">
      {/* Live Esports Widget */}
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
          {liveMatch ? (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {liveMatch.tournament}
              </p>
              <h4 className="font-bold text-lg mb-2">{liveMatch.team1} vs {liveMatch.team2}</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <span>LIVE — {liveMatch.score1} : {liveMatch.score2}</span>
              </div>
              {liveMatch.streamUrl ? (
                <Button asChild className="w-full gap-2">
                  <a href={liveMatch.streamUrl} target="_blank" rel="noopener noreferrer">
                    Watch Live
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              ) : (
                <Button asChild className="w-full gap-2" variant="secondary">
                  <Link to="/esports">View Match</Link>
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No live matches right now
            </p>
          )}
        </div>
      </div>

      {/* Predictions Widget */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Predict & Win XP
            </h3>
            <Link to="/esports">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                View All
              </Button>
            </Link>
          </div>

          {showUpcoming.length > 0 ? (
            <div className="space-y-3">
              {showUpcoming.map((match) => (
                <PredictionCard key={match.id} match={match} compact />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No upcoming matches right now
            </p>
          )}

          <div className="flex justify-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              25 XP to predict
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              60 XP if correct
            </span>
          </div>
        </CardContent>
      </Card>

      {/* XP Leaderboard */}
      <div className="bg-card rounded-lg border overflow-hidden card-shadow dark:neon-border">
        <div className="bg-gradient-to-r from-yellow-500/15 to-primary/10 p-4 border-b">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Top Players</h3>
          </div>
        </div>
        <div className="p-3 space-y-1">
          {leaderboardLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5">
                <div className="w-5 h-3 bg-secondary rounded animate-pulse" />
                <div className="w-6 h-6 rounded-full bg-secondary animate-pulse" />
                <div className="flex-1 h-3 bg-secondary rounded animate-pulse" />
                <div className="w-12 h-3 bg-secondary rounded animate-pulse" />
              </div>
            ))
          ) : leaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No players yet — be the first!
            </p>
          ) : (
            leaderboard.map((player) => (
              <div
                key={player.rank}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors ${
                  player.rank <= 3 ? "bg-secondary/60" : "hover:bg-secondary/40"
                }`}
              >
                <span className="w-5 text-center text-xs font-bold">
                  {player.rank <= 3 ? (
                    <Crown className={`h-3.5 w-3.5 mx-auto ${
                      player.rank === 1 ? "text-yellow-500" :
                      player.rank === 2 ? "text-slate-400" :
                      "text-orange-400"
                    }`} />
                  ) : (
                    <span className="text-muted-foreground">{player.rank}</span>
                  )}
                </span>
                {player.avatarUrl ? (
                  <img
                    src={player.avatarUrl}
                    alt={player.username}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                    {player.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm font-medium truncate">{player.username}</span>
                <span className="text-xs text-muted-foreground font-mono">{player.xp.toLocaleString()} XP</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Daily Trivia */}
      <TriviaWidget />

      {/* Friends Online */}
      <div className="bg-card rounded-lg border p-4 card-shadow">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Friends Online
        </h3>
        <p className="text-sm text-muted-foreground text-center py-2">
          Friends activity coming soon
        </p>
      </div>
    </aside>
  );
}
