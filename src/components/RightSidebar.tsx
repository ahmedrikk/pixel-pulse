import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PredictionCard } from "./PredictionCard";
import { Card, CardContent } from "@/components/ui/card";
import { TriviaWidget } from "@/components/shared/TriviaWidget";
import { CategoryPillsWidget } from "@/components/sidebar/CategoryPillsWidget";
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
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
  const { upcomingMatches } = useEsportsMatches();
  // Show a single match in the sidebar (full list lives on the Esports tab)
  const showUpcoming = upcomingMatches.slice(0, 1).map(toPredictionMatch);

  return (
    <aside className="w-full lg:w-72 space-y-4">
      {/* Predictions Widget — pure live score card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Predict & Win
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
        </CardContent>
      </Card>

      {/* Daily Trivia */}
      <TriviaWidget />

      {/* Browse by category */}
      <CategoryPillsWidget />
    </aside>
  );
}
