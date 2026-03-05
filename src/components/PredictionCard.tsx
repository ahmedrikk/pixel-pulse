import { useState, useMemo } from "react";
import { TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { submitPrediction } from "@/lib/xpService";
import { toast } from "sonner";
import { differenceInMinutes, parseISO } from "date-fns";

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

const GAME_ICONS: Record<string, string> = {
  valorant: "🔫",
  cs2: "💣",
  lol: "⚔️",
  dota2: "🛡️",
  overwatch: "🦸",
  r6: "🔒",
};

export function PredictionCard({
  match,
  onPredict,
  compact = false,
}: PredictionCardProps) {
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

    setIsSubmitting(true);
    const result = await submitPrediction(parseInt(match.id), team === "teamA" ? match.teamA.name : match.teamB.name);
    
    if (result) {
      setPredicted(team);
      onPredict?.(match.id, team);
      
      if (result.awarded) {
        toast.success(`+${result.awarded} XP!`, {
          description: `Prediction submitted for ${team === "teamA" ? match.teamA.name : match.teamB.name}`,
        });
      }
      
      if (result.capped) {
        toast.info("Daily prediction limit reached!");
      }
    } else {
      toast.error("Failed to submit prediction. Please try again.");
    }
    
    setIsSubmitting(false);
  };

  const teamAColor = "from-blue-500 to-blue-600";
  const teamBColor = "from-red-500 to-red-600";

  if (compact) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{GAME_ICONS[match.gameTitle] || "🎮"}</span>
              <span className="truncate max-w-[100px]">{match.leagueName}</span>
            </div>
            {isLocked && match.status === "upcoming" && (
              <span className="text-[10px] text-destructive flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                Locked
              </span>
            )}
          </div>

          {/* Teams */}
          <div className="space-y-1.5">
            {/* Team A */}
            <button
              onClick={() => handlePredict("teamA")}
              disabled={isLocked || isSubmitting || !!predicted}
              className={cn(
                "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all",
                predicted === "teamA"
                  ? "bg-blue-500/20 border border-blue-500"
                  : "bg-secondary/50 hover:bg-secondary",
                (isLocked || !!predicted) && !predicted && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="text-base">{match.teamA.logo}</span>
              <span className="flex-1 text-xs font-medium truncate">
                {match.teamA.shortName}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {match.teamA.probability}%
              </span>
            </button>

            {/* Team B */}
            <button
              onClick={() => handlePredict("teamB")}
              disabled={isLocked || isSubmitting || !!predicted}
              className={cn(
                "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all",
                predicted === "teamB"
                  ? "bg-red-500/20 border border-red-500"
                  : "bg-secondary/50 hover:bg-secondary",
                (isLocked || !!predicted) && !predicted && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="text-base">{match.teamB.logo}</span>
              <span className="flex-1 text-xs font-medium truncate">
                {match.teamB.shortName}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {match.teamB.probability}%
              </span>
            </button>
          </div>

          {/* XP Reward Info */}
          <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              20 XP to predict
            </span>
            <span className="flex items-center gap-0.5">
              <CheckCircle className="h-3 w-3" />
              65 XP if correct
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full version
  return (
    <Card className={cn("overflow-hidden", match.status === "live" && "border-primary/30")}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{GAME_ICONS[match.gameTitle] || "🎮"}</span>
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
            <div className="text-3xl mb-1">{match.teamA.logo}</div>
            <p className="font-bold">{match.teamA.shortName}</p>
            <p className="text-xs text-muted-foreground">{match.teamA.probability}%</p>
          </div>

          {/* VS */}
          <div className="text-lg font-bold text-muted-foreground">VS</div>

          {/* Team B */}
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{match.teamB.logo}</div>
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

        {/* XP Info */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            20 XP to predict
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            65 XP if correct
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
