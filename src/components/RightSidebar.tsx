import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, Users, HelpCircle, ExternalLink, Radio, Trophy, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRIENDS_ONLINE, LIVE_MATCH } from "@/data/mockNews";
import { ESPORTS_MATCHES } from "@/data/esportsData";
import { PredictionCard } from "./PredictionCard";
import { Card, CardContent } from "@/components/ui/card";

export function RightSidebar() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [upcomingMatches, setUpcomingMatches] = useState<typeof ESPORTS_MATCHES>([]);

  useEffect(() => {
    // Filter upcoming matches and sort by soonest
    const upcoming = ESPORTS_MATCHES
      .filter(m => m.status === "upcoming")
      .slice(0, 2);
    setUpcomingMatches(upcoming);
  }, []);

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
          
          {upcomingMatches.length > 0 ? (
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <PredictionCard
                  key={match.id}
                  match={match}
                  compact
                />
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
              20 XP to predict
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              65 XP if correct
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Event */}
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

      {/* Daily Trivia Widget */}
      <Link to="/trivia">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors group">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
                <HelpCircle className="h-4 w-4 text-accent" />
                Daily Trivia
              </h3>
              <Zap className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Test your gaming knowledge and earn up to <strong>155 XP</strong>!
            </p>
            <Button className="w-full gap-2" variant="secondary">
              Play Now
              <Trophy className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </Link>

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
    </aside>
  );
}
