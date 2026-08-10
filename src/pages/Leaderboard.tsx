import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Medal,
  Flame,
  Target,
  Crown,
  ChevronLeft,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  RANK_TIERS,
  getRankTier,
  XP_PER_TIER,
  type RankTier,
} from "@/lib/xpConstants";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  xpSeason: number;
  tier: number;
  dailyStreak: number;
  correctPredictions: number;
  totalPredictions: number;
  weeklyXP?: number;
}

// Rows come from SECURITY DEFINER RPCs (see migration
// 20260707130000_leaderboard_and_hype.sql) — profiles + xp_events +
// predictions aggregated server-side so RLS-protected tables stay private.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

async function fetchSeasonBoard(): Promise<LeaderboardEntry[]> {
  const { data } = await sb.rpc("get_season_leaderboard");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    username: r.username,
    avatar: r.avatar_url ?? undefined,
    xpSeason: r.xp_season,
    tier: r.tier,
    dailyStreak: r.daily_streak,
    correctPredictions: 0,
    totalPredictions: 0,
  }));
}

async function fetchWeeklyBoard(): Promise<LeaderboardEntry[]> {
  const { data } = await sb.rpc("get_weekly_leaderboard");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    username: r.username,
    avatar: r.avatar_url ?? undefined,
    xpSeason: Number(r.weekly_xp),
    tier: r.tier,
    dailyStreak: r.daily_streak,
    correctPredictions: 0,
    totalPredictions: 0,
    weeklyXP: Number(r.weekly_xp),
  }));
}

async function fetchPredictionBoard(): Promise<LeaderboardEntry[]> {
  const { data } = await sb.rpc("get_prediction_leaderboard");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    username: r.username,
    avatar: r.avatar_url ?? undefined,
    xpSeason: 0,
    tier: r.tier,
    dailyStreak: 0,
    correctPredictions: Number(r.correct_predictions),
    totalPredictions: Number(r.total_predictions),
  }));
}

function EmptyBoard({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function RankBadge({ rank, tier }: { rank: number; tier: number }) {
  const rankTier = getRankTier(rank <= 1 ? 0 : rank <= 2 ? 1 : rank <= 5 ? 5 : rank <= 10 ? 10 : 50);
  const tierInfo = RANK_TIERS[rankTier];

  if (rank === 1) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
        <Crown className="h-5 w-5 text-white" />
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg">
        <Medal className="h-5 w-5 text-white" />
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg">
        <Medal className="h-5 w-5 text-white" />
      </div>
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
      style={{ backgroundColor: tierInfo.color }}
    >
      {rank}
    </div>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  showPredictionAccuracy,
}: {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  showPredictionAccuracy?: boolean;
}) {
  const accuracy =
    entry.totalPredictions > 0
      ? Math.round((entry.correctPredictions / entry.totalPredictions) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-colors",
        isCurrentUser
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-secondary/50"
      )}
    >
      <RankBadge rank={entry.rank} tier={entry.tier} />

      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarImage src={entry.avatar} />
        <AvatarFallback className="text-xs bg-secondary">
          {entry.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/user/${entry.userId}`}
            className="font-semibold text-sm truncate hover:text-primary transition-colors"
          >
            {entry.username}
          </Link>
          {entry.dailyStreak > 7 && (
            <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
              <Flame className="h-3 w-3" />
              {entry.dailyStreak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tier {entry.tier}</span>
          <span>•</span>
          <span>{entry.xpSeason.toLocaleString()} XP</span>
        </div>
      </div>

      {showPredictionAccuracy ? (
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm font-bold">
            <Target className="h-3.5 w-3.5 text-primary" />
            {accuracy}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            {entry.correctPredictions}/{entry.totalPredictions} correct
          </div>
        </div>
      ) : (
        <div className="text-right">
          <div className="text-sm font-bold">
            {entry.weeklyXP?.toLocaleString() || entry.xpSeason.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {entry.weeklyXP ? "this week" : "season XP"}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState("season");
  const [seasonBoard, setSeasonBoard] = useState<LeaderboardEntry[]>([]);
  const [weeklyBoard, setWeeklyBoard] = useState<LeaderboardEntry[]>([]);
  const [predictionBoard, setPredictionBoard] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBoards() {
      const [season, weekly, predictions, { data: auth }] = await Promise.all([
        fetchSeasonBoard(),
        fetchWeeklyBoard(),
        fetchPredictionBoard(),
        supabase.auth.getUser(),
      ]);
      setSeasonBoard(season);
      setWeeklyBoard(weekly);
      setPredictionBoard(predictions);
      setCurrentUserId(auth?.user?.id ?? null);
      setLoading(false);
    }
    fetchBoards();
  }, []);

  const activeBoard =
    activeTab === "weekly" ? weeklyBoard
    : activeTab === "predictions" ? predictionBoard
    : seasonBoard;
  const userRank = currentUserId
    ? activeBoard.find((e) => e.userId === currentUserId) ?? null
    : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-nav backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-xl">Leaderboard</h1>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-2xl">
        {/* Rank Tiers Legend */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Medal className="h-4 w-4" />
              Rank Tiers
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(RANK_TIERS)
                .slice(0, 4)
                .map(([key, tier]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tier.color }}
                    />
                    <span className="text-xs text-muted-foreground capitalize">
                      {tier.label}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="season" className="gap-1">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Season</span>
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-1">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Weekly</span>
            </TabsTrigger>
            <TabsTrigger value="predictions" className="gap-1">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Predictions</span>
            </TabsTrigger>
          </TabsList>

          {/* User's Rank Card */}
          {userRank && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                    {userRank.rank}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Your Rank</p>
                    <p className="text-xs text-muted-foreground">
                      {activeTab === "predictions"
                        ? `${Math.round(
                            (userRank.correctPredictions / userRank.totalPredictions) * 100
                          )}% accuracy`
                        : `${userRank.xpSeason.toLocaleString()} XP`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/profile">View Profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <TabsContent value="season" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
                  ))
                ) : seasonBoard.length === 0 ? (
                  <EmptyBoard message="No players on the board yet — earn XP to claim the top spot!" />
                ) : (
                  seasonBoard.map((entry) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={entry}
                      isCurrentUser={entry.userId === currentUserId}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-yellow-500" />
                <div>
                  <h3 className="font-bold">Weekly Challenge</h3>
                  <p className="text-xs text-muted-foreground">
                    Top 3 this week earn bonus XP!
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                  1st: +150 XP
                </Badge>
                <Badge variant="secondary" className="bg-gray-400/20 text-gray-600">
                  2nd: +100 XP
                </Badge>
                <Badge variant="secondary" className="bg-amber-600/20 text-amber-700">
                  3rd: +75 XP
                </Badge>
              </div>
            </Card>

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
                  ))
                ) : weeklyBoard.length === 0 ? (
                  <EmptyBoard message="Nobody has earned XP this week yet. Read, predict, and review to get on the board!" />
                ) : (
                  weeklyBoard.map((entry) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={entry}
                      isCurrentUser={entry.userId === currentUserId}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-pink-500/10 border-blue-500/20">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-blue-500" />
                <div>
                  <h3 className="font-bold">Prediction Leaderboard</h3>
                  <p className="text-xs text-muted-foreground">
                    Ranked by prediction accuracy this season
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                <p>🎯 Weekly "Oracle" badge for top predictor</p>
                <p>👑 Seasonal "Season Oracle" title for #1</p>
              </div>
            </Card>

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
                  ))
                ) : predictionBoard.length === 0 ? (
                  <EmptyBoard message="No resolved predictions yet. Call some esports matches to start your accuracy record!" />
                ) : (
                  predictionBoard.map((entry) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={entry}
                      isCurrentUser={entry.userId === currentUserId}
                      showPredictionAccuracy
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>
    <Footer />
    </div>
  );
}
