import { useState, useMemo } from "react";
import { Trophy, Lock, Check, Star, Sparkles, Gift, Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  TIER_REWARDS,
  XP_PER_TIER,
  getActName,
  getActForTier,
  isStarTier,
  type TierReward,
} from "@/lib/xpConstants";

interface BattlePassPanelProps {
  currentTier: number;
  xpSeason: number;
  className?: string;
}

interface TierInfo {
  tier: number;
  reward: TierReward;
  status: "locked" | "current" | "completed";
  progress: number;
}

export function BattlePassPanel({
  currentTier,
  xpSeason,
  className,
}: BattlePassPanelProps) {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [activeAct, setActiveAct] = useState(getActForTier(currentTier || 1));

  const tierInfo = useMemo(() => {
    const info: TierInfo[] = [];
    for (let tier = 1; tier <= 25; tier++) {
      const tierStartXp = (tier - 1) * XP_PER_TIER;
      const tierEndXp = tier * XP_PER_TIER;
      const tierProgress = Math.max(0, Math.min(xpSeason - tierStartXp, XP_PER_TIER));
      
      let status: "locked" | "current" | "completed" = "locked";
      if (tier < currentTier) status = "completed";
      else if (tier === currentTier) status = "current";

      info.push({
        tier,
        reward: TIER_REWARDS[tier],
        status,
        progress: status === "completed" ? 100 : (tierProgress / XP_PER_TIER) * 100,
      });
    }
    return info;
  }, [currentTier, xpSeason]);

  const currentActTiers = tierInfo.filter(
    (t) => getActForTier(t.tier) === activeAct
  );

  const xpIntoCurrentTier = xpSeason % XP_PER_TIER;
  const xpToNextTier = XP_PER_TIER - xpIntoCurrentTier;

  const getRewardIcon = (type: TierReward["type"]) => {
    switch (type) {
      case "badge":
        return <Trophy className="h-5 w-5" />;
      case "title":
        return <Sparkles className="h-5 w-5" />;
      case "coupon":
        return <Gift className="h-5 w-5" />;
      case "frame":
        return <Crown className="h-5 w-5" />;
      case "cosmetic":
        return <Sparkles className="h-5 w-5" />;
      case "bundle":
        return <Gift className="h-5 w-5" />;
      default:
        return <Gift className="h-5 w-5" />;
    }
  };

  const getRewardColor = (type: TierReward["type"]) => {
    switch (type) {
      case "badge":
        return "from-yellow-500 to-amber-500";
      case "title":
        return "from-purple-500 to-pink-500";
      case "coupon":
        return "from-green-500 to-emerald-500";
      case "frame":
        return "from-blue-500 to-cyan-500";
      case "cosmetic":
        return "from-orange-500 to-red-500";
      case "bundle":
        return "from-primary to-accent";
      default:
        return "from-muted to-muted-foreground";
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header - Current Progress */}
      <div className="bg-gradient-to-br from-card to-secondary/30 rounded-xl p-5 border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Battle Pass
            </h3>
            <p className="text-sm text-muted-foreground">
              {getActName(currentTier)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">Tier {currentTier}</div>
            <div className="text-xs text-muted-foreground">
              {xpIntoCurrentTier} / {XP_PER_TIER} XP
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Total Progress</span>
            <span>{Math.round((xpSeason / (25 * XP_PER_TIER)) * 100)}% to Tier 25</span>
          </div>
          <Progress
            value={(xpSeason / (25 * XP_PER_TIER)) * 100}
            className="h-2"
          />
        </div>

        {currentTier < 25 && (
          <p className="text-xs text-center mt-3 text-muted-foreground">
            {xpToNextTier} XP to Tier {currentTier + 1}
          </p>
        )}
      </div>

      {/* Act Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
        {[1, 2, 3, 4, 5].map((act) => (
          <button
            key={act}
            onClick={() => setActiveAct(act)}
            className={cn(
              "flex-1 py-2 text-xs font-medium rounded-md transition-all",
              activeAct === act
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Act {act}
          </button>
        ))}
      </div>

      {/* Tier Grid for Current Act */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          {getActName((activeAct - 1) * 5 + 1)}
          <span className="text-xs text-muted-foreground font-normal">
            (Tiers {(activeAct - 1) * 5 + 1}-{activeAct * 5})
          </span>
        </h4>

        <div className="grid grid-cols-5 gap-2">
          {currentActTiers.map((tier) => (
            <button
              key={tier.tier}
              onClick={() => setSelectedTier(tier.tier)}
              className={cn(
                "relative aspect-square rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1",
                tier.status === "completed" &&
                  "border-green-500/50 bg-green-500/10 hover:bg-green-500/20",
                tier.status === "current" &&
                  "border-primary bg-primary/10 hover:bg-primary/20 ring-2 ring-primary/30",
                tier.status === "locked" &&
                  "border-muted bg-muted/30 opacity-60 hover:opacity-80"
              )}
            >
              {/* Star indicator for milestone tiers */}
              {isStarTier(tier.tier) && (
                <Star
                  className={cn(
                    "absolute -top-1.5 -right-1.5 h-4 w-4 fill-yellow-400 text-yellow-500",
                    tier.status === "locked" && "opacity-50"
                  )}
                />
              )}

              {/* Tier Number */}
              <span
                className={cn(
                  "text-lg font-bold",
                  tier.status === "completed" && "text-green-500",
                  tier.status === "current" && "text-primary",
                  tier.status === "locked" && "text-muted-foreground"
                )}
              >
                {tier.tier}
              </span>

              {/* Status Icon */}
              <div className="text-muted-foreground">
                {tier.status === "completed" && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {tier.status === "current" && (
                  <div className="h-1.5 w-full bg-primary/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${tier.progress}%` }}
                    />
                  </div>
                )}
                {tier.status === "locked" && <Lock className="h-3 w-3" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Full Tier List Preview */}
      <ScrollArea className="h-[200px] rounded-xl border">
        <div className="p-3 space-y-1">
          {tierInfo.map((tier) => (
            <div
              key={tier.tier}
              onClick={() => setSelectedTier(tier.tier)}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                tier.status === "current"
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-secondary/50",
                tier.status === "locked" && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold",
                  getRewardColor(tier.reward.type)
                )}
              >
                {tier.tier}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {tier.reward.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tier.reward.description}
                </p>
              </div>
              {tier.status === "completed" && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              {isStarTier(tier.tier) && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Tier Detail Dialog */}
      <Dialog
        open={selectedTier !== null}
        onOpenChange={() => setSelectedTier(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Tier {selectedTier}
              {selectedTier && isStarTier(selectedTier) && (
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-400" />
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedTier && getActName(selectedTier)}
            </DialogDescription>
          </DialogHeader>

          {selectedTier && (
            <div className="space-y-4">
              {/* Reward Preview */}
              <div
                className={cn(
                  "p-6 rounded-xl bg-gradient-to-br flex flex-col items-center text-center text-white",
                  getRewardColor(TIER_REWARDS[selectedTier].type)
                )}
              >
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  {getRewardIcon(TIER_REWARDS[selectedTier].type)}
                </div>
                <h4 className="text-lg font-bold">
                  {TIER_REWARDS[selectedTier].label}
                </h4>
                <p className="text-sm text-white/80">
                  {TIER_REWARDS[selectedTier].description}
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    tierInfo[selectedTier - 1]?.status === "completed" &&
                      "text-green-500",
                    tierInfo[selectedTier - 1]?.status === "current" &&
                      "text-primary",
                    tierInfo[selectedTier - 1]?.status === "locked" &&
                      "text-muted-foreground"
                  )}
                >
                  {tierInfo[selectedTier - 1]?.status === "completed"
                    ? "Unlocked"
                    : tierInfo[selectedTier - 1]?.status === "current"
                    ? "In Progress"
                    : "Locked"}
                </span>
              </div>

              {/* XP Required */}
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <span className="text-sm text-muted-foreground">XP Required</span>
                <span className="text-sm font-medium">
                  {(selectedTier - 1) * XP_PER_TIER} XP
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
