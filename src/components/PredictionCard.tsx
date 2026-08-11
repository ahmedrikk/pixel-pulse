import { useState, useMemo } from "react";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { submitPrediction } from "@/lib/xpService";
import { toast } from "sonner";
import { differenceInMinutes, parseISO } from "date-fns";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { GameArtwork } from "@/components/shared/GameArtwork";

interface EsportsTeam {
  name: string;
  logo: string;
  shortName: string;
  flag: string;
  probability: number;
}

interface EsportsMatch {
  id: string;
  gameTitle: string;
  leagueName: string;
  format: string;
  teamA: EsportsTeam;
  teamB: EsportsTeam;
  scoreA: number | null;
  scoreB: number | null;
  timestamp: string;
  status: "live" | "upcoming" | "completed";
  streamUrl?: string;
  userPrediction?: "teamA" | "teamB" | null;
}

interface PredictionCardProps {
  match: EsportsMatch;
  onPredict?: (matchId: string, team: "teamA" | "teamB") => void;
  compact?: boolean;
}

function TeamLogo({ logo, name, compact = false }: { logo: string; name: string; compact?: boolean }) {
  const size = compact ? "h-6 w-6" : "h-12 w-12";
  if (/^https?:\/\//i.test(logo)) {
    return <img src={logo} alt={`${name} logo`} className={`${size} rounded-lg bg-secondary object-contain`} />;
  }
  return (
    <span className={`${size} inline-flex items-center justify-center rounded-lg bg-secondary text-base font-bold`}>
      {logo || name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function PredictionCard({
  match,
  onPredict,
  compact = false,
}: PredictionCardProps) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [predicted, setPredicted] = useState<"teamA" | "teamB" | null>(
    match.userPrediction || null
  );

  const isLocked = useMemo(() => {
    if (match.status !== "upcoming") return true;
    const matchTime = parseISO(match.timestamp);
    const minutesUntilMatch = differenceInMinutes(matchTime, new Date());
    return minutesUntilMatch <= 5; // Lock 5 minutes before match
  }, [match]);

  const handlePredict = async (team: "teamA" | "teamB") => {
    if (isSubmitting || isLocked || predicted) return;

    if (!isAuthenticated) {
      openAuthModal("esports_predict", { matchId: match.id });
      return;
    }

    setIsSubmitting(true);
    const result = await submitPrediction(parseInt(match.id), team === "teamA" ? match.teamA.name : match.teamB.name);
    
    if (result) {
      setPredicted(team);
      onPredict?.(match.id, team);
      
      toast.success("Prediction submitted", {
        description: `You picked ${team === "teamA" ? match.teamA.name : match.teamB.name}`,
      });
    } else {
      toast.error("Failed to submit prediction. Please try again.");
    }
    
    setIsSubmitting(false);
  };

  const teamAColor = "from-blue-500 to-blue-600";
  const teamBColor = "from-red-500 to-red-600";

  if (compact) {
    return (
      <div className="overflow-hidden rounded-lg border bg-background/50">
        <div className="p-3">
          {/* Header: tournament name */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GameArtwork name={match.gameTitle} className="h-5 w-5 rounded" />
              <span className="truncate max-w-[140px]">{match.leagueName}</span>
            </div>
            {match.status === "live" && (
              <span className="flex items-center gap-1 text-tiny-label font-medium text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                LIVE
              </span>
            )}
          </div>

          {/* Teams + score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo logo={match.teamA.logo} name={match.teamA.name} compact />
                <span className="text-xs font-medium truncate">
                  {match.teamA.name}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums">
                {match.scoreA ?? "-"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo logo={match.teamB.logo} name={match.teamB.name} compact />
                <span className="text-xs font-medium truncate">
                  {match.teamB.name}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums">
                {match.scoreB ?? "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full version
  return (
    <Card className={cn("overflow-hidden", match.status === "live" && "border-primary/30")}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GameArtwork name={match.gameTitle} className="h-8 w-8" />
            <div>
              <p className="text-sm font-medium">{match.leagueName}</p>
              <p className="text-xs text-muted-foreground">{match.format}</p>
            </div>
          </div>
          {isLocked && match.status === "upcoming" && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-3 w-3" />
              Locked
            </div>
          )}
        </div>

        {/* Match Display */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Team A */}
          <div className="flex-1 text-center">
            <div className="mb-1"><TeamLogo logo={match.teamA.logo} name={match.teamA.name} /></div>
            <p className="font-bold">{match.teamA.shortName}</p>
            <p className="text-xs text-muted-foreground">{match.teamA.probability}%</p>
          </div>

          {/* VS */}
          <div className="text-lg font-bold text-muted-foreground">VS</div>

          {/* Team B */}
          <div className="flex-1 text-center">
            <div className="mb-1"><TeamLogo logo={match.teamB.logo} name={match.teamB.name} /></div>
            <p className="font-bold">{match.teamB.shortName}</p>
            <p className="text-xs text-muted-foreground">{match.teamB.probability}%</p>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="mb-4">
          <Progress
            value={match.teamA.probability}
            className="h-2"
          />
        </div>

        {/* Prediction Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handlePredict("teamA")}
            disabled={isLocked || isSubmitting || !!predicted}
            variant={predicted === "teamA" ? "default" : "outline"}
            className={cn(
              "w-full",
              predicted === "teamA" && "bg-blue-500 hover:bg-blue-600"
            )}
          >
            {predicted === "teamA" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Picked {match.teamA.shortName}
              </>
            ) : (
              `Pick ${match.teamA.shortName}`
            )}
          </Button>

          <Button
            onClick={() => handlePredict("teamB")}
            disabled={isLocked || isSubmitting || !!predicted}
            variant={predicted === "teamB" ? "default" : "outline"}
            className={cn(
              "w-full",
              predicted === "teamB" && "bg-red-500 hover:bg-red-600"
            )}
          >
            {predicted === "teamB" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Picked {match.teamB.shortName}
              </>
            ) : (
              `Pick ${match.teamB.shortName}`
            )}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
