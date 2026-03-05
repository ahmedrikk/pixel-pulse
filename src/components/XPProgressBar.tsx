import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Trophy, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { XP_PER_TIER, getActName } from "@/lib/xpConstants";

interface XPProgressBarProps {
  compact?: boolean;
}

interface UserXPData {
  xp_today: number;
  xp_season: number;
  tier: number;
  streak_count: number;
  daily_streak: number;
}

export function XPProgressBar({ compact = false }: XPProgressBarProps) {
  const [userData, setUserData] = useState<UserXPData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserXP() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("xp_today, xp_season, tier, daily_streak")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch user XP:", error);
        setLoading(false);
        return;
      }

      setUserData({
        xp_today: data.xp_today || 0,
        xp_season: data.xp_season || 0,
        tier: data.tier || 0,
        streak_count: data.daily_streak || 0,
        daily_streak: data.daily_streak || 0,
      });
      setLoading(false);
    }

    fetchUserXP();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("xp_updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          setUserData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              xp_today: payload.new.xp_today || 0,
              xp_season: payload.new.xp_season || 0,
              tier: payload.new.tier || 0,
              daily_streak: payload.new.daily_streak || 0,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || !userData) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'px-2' : 'px-3 py-1.5'}`}>
        <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
        {!compact && <div className="w-24 h-4 bg-muted rounded animate-pulse" />}
      </div>
    );
  }

  const currentTier = userData.tier || 0;
  const nextTier = Math.min(currentTier + 1, 25);
  const xpIntoTier = (userData.xp_season || 0) % XP_PER_TIER;
  const xpForNextTier = XP_PER_TIER;
  const progressPercent = (xpIntoTier / xpForNextTier) * 100;
  const xpRemaining = xpForNextTier - xpIntoTier;

  // Compact view for navbar
  if (compact) {
    return (
      <Link
        to="/profile"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
      >
        {/* Tier Badge */}
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white">
            {currentTier}
          </div>
        </div>

        {/* Mini Progress Bar */}
        <div className="w-16">
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        {/* Streak Indicator */}
        {userData.daily_streak > 0 && (
          <div className="flex items-center gap-0.5 text-orange-500">
            <Flame className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{userData.daily_streak}</span>
          </div>
        )}
      </Link>
    );
  }

  // Full view
  return (
    <Link
      to="/profile"
      className="block p-3 rounded-xl bg-gradient-to-br from-secondary/50 to-background border hover:border-primary/30 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">Tier {currentTier}</p>
            <p className="text-[10px] text-muted-foreground">{getActName(currentTier)}</p>
          </div>
        </div>
        
        {userData.daily_streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500">
            <Flame className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">{userData.daily_streak} Day Streak</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {xpIntoTier} / {xpForNextTier} XP
          </span>
          <span className="font-medium text-primary">
            {xpRemaining} to Tier {nextTier}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Daily XP */}
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <Zap className="h-3 w-3 text-yellow-500" />
        <span>{userData.xp_today} / 400 XP today</span>
      </div>
    </Link>
  );
}
