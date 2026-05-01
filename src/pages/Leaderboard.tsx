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

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    userId: "1",
    username: "PixelProwler",
    xpSeason: 24500,
    tier: 24,
    dailyStreak: 45,
    correctPredictions: 28,
    totalPredictions: 35,
    weeklyXP: 3200,
  },
  {
    rank: 2,
    userId: "2",
    username: "GameGladiator",
    xpSeason: 23800,
    tier: 23,
    dailyStreak: 32,
    correctPredictions: 25,
    totalPredictions: 32,
    weeklyXP: 2850,
  },
  {
    rank: 3,
    userId: "3",
    username: "EsportsOracle",
    xpSeason: 22100,
    tier: 22,
    dailyStreak: 28,
    correctPredictions: 31,
    totalPredictions: 38,
    weeklyXP: 2400,
  },
  {
    rank: 4,
    userId: "4",
    username: "NewsNinja",
    xpSeason: 19500,
    tier: 19,
    dailyStreak: 21,
    correctPredictions: 18,
    totalPredictions: 25,
    weeklyXP: 1950,
  },
  {
    rank: 5,
    userId: "5",
    username: "ComboKing",
    xpSeason: 18200,
    tier: 18,
    dailyStreak: 19,
    correctPredictions: 15,
    totalPredictions: 22,
    weeklyXP: 1600,
  },
  {
    rank: 6,
    userId: "6",
    username: "SpeedRunner",
    xpSeason: 16800,
    tier: 16,
    dailyStreak: 15,
    correctPredictions: 12,
    totalPredictions: 18,
    weeklyXP: 1400,
  },
  {
    rank: 7,
    userId: "7",
    username: "TriviaMaster",
    xpSeason: 15400,
    tier: 15,
    dailyStreak: 12,
    correctPredictions: 20,
    totalPredictions: 28,
    weeklyXP: 1200,
  },
  {
    rank: 8,
    userId: "8",
    username: "HeadlineHero",
    xpSeason: 14200,
    tier: 14,
    dailyStreak: 10,
    correctPredictions: 10,
    totalPredictions: 15,
    weeklyXP: 950,
  },
  {
    rank: 9,
    userId: "9",
    username: "ButtonMasher",
    xpSeason: 12800,
    tier: 12,
    dailyStreak: 8,
    correctPredictions: 8,
    totalPredictions: 12,
    weeklyXP: 750,
  },
  {
    rank: 10,
    userId: "10",
    username: "Newcomer",
    xpSeason: 10500,
    tier: 10,
    dailyStreak: 5,
    correctPredictions: 5,
    totalPredictions: 8,
    weeklyXP: 500,
  },
];

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
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, xp_season, tier, daily_streak")
          .eq("id", user.id)
          .single();

        if (data) {
          setUserRank({
            rank: 42,
            userId: user.id,
            username: user.user_metadata?.username || "You",
            xpSeason: data.xp_season || 0,
            tier: data.tier || 0,
            dailyStreak: data.daily_streak || 0,
            correctPredictions: 12,
            totalPredictions: 20,
            weeklyXP: 850,
          });
        }
      }
      setLoading(false);
    }
    fetchUserStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
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
                {MOCK_LEADERBOARD.map((entry) => (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={entry.userId === userRank?.userId}
                  />
                ))}
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
                {[...MOCK_LEADERBOARD]
                  .sort((a, b) => (b.weeklyXP || 0) - (a.weeklyXP || 0))
                  .map((entry, idx) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={{ ...entry, rank: idx + 1 }}
                      isCurrentUser={entry.userId === userRank?.userId}
                    />
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-purple-500" />
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
                {[...MOCK_LEADERBOARD]
                  .sort(
                    (a, b) =>
                      b.correctPredictions / (b.totalPredictions || 1) -
                      a.correctPredictions / (a.totalPredictions || 1)
                  )
                  .map((entry, idx) => (
                    <LeaderboardRow
                      key={entry.userId}
                      entry={{ ...entry, rank: idx + 1 }}
                      isCurrentUser={entry.userId === userRank?.userId}
                      showPredictionAccuracy
                    />
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>
    <Footer />
    </div>
  );
}
