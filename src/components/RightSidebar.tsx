import { Link, useNavigate } from "react-router-dom";
import { Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PredictionCard } from "./PredictionCard";
import { Card, CardContent } from "@/components/ui/card";
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
import { useTrendingTopics } from "@/hooks/useTrendingTopics";
import type { EsportsMatch as PandaMatch } from "@/lib/pandascore";

// Adapter: convert PandaScore EsportsMatch to the shape PredictionCard expects
function toPredictionMatch(m: PandaMatch) {
  return {
    id: String(m.id),
    gameTitle: m.game,
    leagueName: m.league,
    format: m.numberOfGames ? `Bo${m.numberOfGames}` : "Match",
    teamA: { name: m.team1, logo: m.team1Image ?? "", shortName: m.team1.slice(0, 3).toUpperCase(), flag: "", probability: 50 },
    teamB: { name: m.team2, logo: m.team2Image ?? "", shortName: m.team2.slice(0, 3).toUpperCase(), flag: "", probability: 50 },
    scoreA: m.score1,
    scoreB: m.score2,
    timestamp: m.begin_at ?? new Date().toISOString(),
    status: (m.status === "running" ? "live" : m.status === "finished" ? "completed" : "upcoming") as "live" | "upcoming" | "completed",
    streamUrl: m.streamUrl ?? undefined,
  };
}

function formatHashtag(tag: string): string {
  const clean = tag.replace(/^#+/, "").replace(/[-_\s]+/g, "");
  if (/^[a-z0-9]+$/.test(clean)) {
    if (/^[a-z]{2,3}$/.test(clean)) return clean.toUpperCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

export function RightSidebar() {
  const { upcomingMatches } = useEsportsMatches();
  const { topics, isLoading } = useTrendingTopics(5);
  const navigate = useNavigate();
  // Show a single match in the sidebar (full list lives on the Esports tab)
  const showUpcoming = upcomingMatches.slice(0, 1).map(toPredictionMatch);

  const openTopic = (tag: string) => {
    navigate(`/?category=${encodeURIComponent(tag)}`);
  };

  return (
    <aside className="w-full space-y-3">
      <Card className="overflow-hidden rounded-xl border-border/50 shadow-none">
        <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-accent/10 to-transparent p-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              Trending
            </h3>
            <span className="text-tiny-label text-muted-foreground">Refreshes every 12h</span>
        </div>

        <CardContent className="p-3.5 pt-4">
          <ol className="space-y-1.5" aria-label="Top five trending news topics">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="w-4 text-right text-xs text-muted-foreground">{index + 1}.</span>
                    <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
                  </li>
                ))
              : topics.map((topic, index) => (
                  <li key={topic.tag} className="flex min-w-0 items-center gap-2">
                    <span className="w-4 flex-none text-right text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <button
                      type="button"
                      onClick={() => openTopic(topic.tag)}
                      className="min-w-0 truncate text-left text-sm text-muted-foreground transition-colors hover:text-primary"
                      title={`#${formatHashtag(topic.tag)} · ${topic.articleCount} article${topic.articleCount === 1 ? "" : "s"}`}
                    >
                      #{formatHashtag(topic.tag)}
                    </button>
                  </li>
                ))}
          </ol>

          {!isLoading && topics.length === 0 && (
            <p className="py-2 text-xs leading-relaxed text-muted-foreground">
              Trending topics will appear as tagged stories arrive.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Predictions Widget — pure live score card */}
      <Card className="overflow-hidden rounded-xl border-border/50 shadow-none">
        <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-accent/10 to-transparent p-3.5">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Match Center
            </h3>
            <Link to="/esports">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                View All
              </Button>
            </Link>
        </div>

        <CardContent className="p-3.5 pt-4">
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

    </aside>
  );
}
