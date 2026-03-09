import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { TrendingUp, ArrowLeft, Radio, Clock, Trophy, ChevronRight, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useXP } from "@/contexts/XPContext";
import { Sun, Moon } from "lucide-react";
import { GAME_FILTERS, ESPORTS_MATCHES, type EsportsMatch, type EsportsTeam } from "@/data/esportsData";
import { format, isToday, isTomorrow, isYesterday, parseISO, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { XPProgressBar } from "@/components/XPProgressBar";

type TabType = "live" | "upcoming" | "results";

function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "MMMM do")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "MMMM do")}`;
  return format(date, "EEEE, MMMM do");
}

function groupByDate(matches: EsportsMatch[]): Record<string, EsportsMatch[]> {
  const groups: Record<string, EsportsMatch[]> = {};
  for (const match of matches) {
    const label = getDateLabel(match.timestamp);
    if (!groups[label]) groups[label] = [];
    groups[label].push(match);
  }
  return groups;
}

function groupByGame(matches: EsportsMatch[]): Record<string, EsportsMatch[]> {
  const groups: Record<string, EsportsMatch[]> = {};
  for (const match of matches) {
    const game = match.gameTitle;
    if (!groups[game]) groups[game] = [];
    groups[game].push(match);
  }
  return groups;
}

/* ── Form Dots ── */
function FormDots({ form }: { form: ("W" | "L" | "D")[] }) {
  return (
    <div className="flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            r === "W" ? "bg-[hsl(var(--win-color))]" : r === "L" ? "bg-[hsl(var(--live-glow))]" : "bg-muted-foreground"
          }`}
        />
      ))}
    </div>
  );
}

/* ── Win Probability Bar ── */
function ProbabilityBar({ teamA, teamB }: { teamA: EsportsTeam; teamB: EsportsTeam }) {
  return (
    <div className="w-full flex items-center gap-2 text-[11px] font-semibold">
      <span className="text-primary w-8 text-right">{teamA.probability}%</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-secondary flex">
        <motion.div
          className="h-full bg-primary rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${teamA.probability}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div
          className="h-full bg-accent rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${teamB.probability}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
      <span className="text-accent w-8">{teamB.probability}%</span>
    </div>
  );
}

/* ── Countdown ── */
function Countdown({ timestamp }: { timestamp: string }) {
  const diff = differenceInSeconds(parseISO(timestamp), new Date());
  if (diff <= 0) return <span className="text-sm text-muted-foreground">Starting soon</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return (
    <span className="text-sm font-mono font-bold text-primary tabular-nums">
      {h > 0 && `${h}h `}{m}m
    </span>
  );
}

/* ── Team Block ── */
function TeamBlock({ team, score, isWinner, side }: { team: EsportsTeam; score: number | null; isWinner: boolean; side: "left" | "right" }) {
  const align = side === "left" ? "text-right items-end" : "text-left items-start";
  return (
    <div className={`flex flex-col gap-1.5 flex-1 min-w-0 ${align}`}>
      <div className={`flex items-center gap-3 ${side === "left" ? "flex-row-reverse" : ""}`}>
        <span className="text-3xl flex-shrink-0">{team.logo}</span>
        <div className={`min-w-0 ${align}`}>
          <div className={`flex items-center gap-1.5 ${side === "left" ? "flex-row-reverse" : ""}`}>
            <span className="text-xs flex-shrink-0">{team.flag}</span>
            <span className={`text-sm font-bold truncate ${isWinner ? "text-[hsl(var(--gold))]" : "text-foreground"}`}>
              {team.name}
            </span>
          </div>
          <FormDots form={team.form} />
        </div>
      </div>
    </div>
  );
}

/* ── Match Card ── */
function MatchCard({ match, onWatchLive }: { match: EsportsMatch; onWatchLive?: () => void }) {
  const gameFilter = GAME_FILTERS.find((g) => g.id === match.gameTitle);
  const isWinnerA = match.status === "completed" && (match.scoreA ?? 0) > (match.scoreB ?? 0);
  const isWinnerB = match.status === "completed" && (match.scoreB ?? 0) > (match.scoreA ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className={`group relative p-5 bg-card border rounded-2xl transition-all duration-200 hover:shadow-lg card-shadow ${
        match.status === "live" ? "border-[hsl(var(--live-glow)/0.3)] shadow-[0_0_20px_-5px_hsl(var(--live-glow)/0.15)]" : "border-border hover:border-primary/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{gameFilter?.icon || "🎮"}</span>
          <span className="text-xs font-medium text-muted-foreground truncate">
            {match.leagueName} · {match.format}
          </span>
        </div>
        <div className="flex-shrink-0">
          {match.status === "live" && (
            <Badge className="bg-[hsl(var(--live-glow))] text-[hsl(0,0%,100%)] border-transparent gap-1.5 text-xs font-bold px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(0,0%,100%)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(0,0%,100%)]" />
              </span>
              LIVE
            </Badge>
          )}
          {match.status === "completed" && (
            <Badge variant="secondary" className="text-muted-foreground text-xs font-bold">FINAL</Badge>
          )}
          {match.status === "upcoming" && (
            <Badge variant="outline" className="text-muted-foreground text-xs font-medium gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(match.timestamp), "MMM d")}
            </Badge>
          )}
        </div>
      </div>

      {/* Face-off */}
      <div className="flex items-center gap-3">
        <TeamBlock team={match.teamA} score={match.scoreA} isWinner={isWinnerA} side="left" />

        {/* Score center */}
        <div className="flex-shrink-0 w-24 flex flex-col items-center gap-1">
          {(match.status === "live" || match.status === "completed") && (
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black ${
                match.status === "live" ? "text-primary" : isWinnerA ? "text-[hsl(var(--gold))]" : "text-muted-foreground"
              }`}>
                {match.scoreA}
              </span>
              <span className="text-lg text-muted-foreground font-bold">:</span>
              <span className={`text-3xl font-black ${
                match.status === "live" ? "text-primary" : isWinnerB ? "text-[hsl(var(--gold))]" : "text-muted-foreground"
              }`}>
                {match.scoreB}
              </span>
            </div>
          )}
          {match.status === "upcoming" && (
            <Countdown timestamp={match.timestamp} />
          )}
        </div>

        <TeamBlock team={match.teamB} score={match.scoreB} isWinner={isWinnerB} side="right" />
      </div>

      {/* Probability bar */}
      <div className="mt-4">
        <ProbabilityBar teamA={match.teamA} teamB={match.teamB} />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {format(parseISO(match.timestamp), "HH:mm")} UTC
        </span>
        {match.status === "live" && match.streamUrl && (
          <a href={match.streamUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); onWatchLive?.(); }}>
            <Button size="sm" className="h-8 text-xs gap-1.5 font-bold rounded-lg">
              <ExternalLink className="h-3.5 w-3.5" />
              Watch Live
            </Button>
          </a>
        )}
        {match.status === "upcoming" && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-lg">
            <Clock className="h-3.5 w-3.5" />
            Set Reminder
          </Button>
        )}
        {match.status === "completed" && (
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 text-muted-foreground">
            Match Details
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   All Games View — grouped by game with "Full Schedule" links
   ═══════════════════════════════════════════════ */
function AllGamesView({ onWatchLive, activeTab, setActiveTab }: { onWatchLive: () => void; activeTab: TabType; setActiveTab: (t: TabType) => void }) {
  const navigate = useNavigate();
  const { addXP } = useXP();

  const liveCount = ESPORTS_MATCHES.filter(m => m.status === "live").length;

  const filteredByTab = useMemo(() => {
    if (activeTab === "upcoming") return ESPORTS_MATCHES.filter(m => m.status === "upcoming").sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (activeTab === "results") return ESPORTS_MATCHES.filter(m => m.status === "completed").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // "live" tab: handled per-game below
    return ESPORTS_MATCHES.filter(m => m.status === "live");
  }, [activeTab]);

  const gameGroups = useMemo(() => groupByGame(filteredByTab), [filteredByTab]);

  // For "live" tab: build groups that always show 2 cards per game,
  // backfilling with recent completed matches when < 2 live
  const liveGameGroups = useMemo(() => {
    if (activeTab !== "live") return {};
    const groups: Record<string, EsportsMatch[]> = {};
    const completedByGame = groupByGame(
      ESPORTS_MATCHES.filter(m => m.status === "completed").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    );
    for (const game of GAME_FILTERS.filter(g => g.id !== "all")) {
      const live = ESPORTS_MATCHES.filter(m => m.status === "live" && m.gameTitle === game.id);
      if (live.length === 0) continue; // skip games with zero live
      const cards = [...live];
      if (cards.length < 2) {
        const backfill = (completedByGame[game.id] || []).slice(0, 2 - cards.length);
        cards.push(...backfill);
      }
      groups[game.id] = cards.slice(0, 2);
    }
    return groups;
  }, [activeTab]);

  const displayGroups = activeTab === "live" ? liveGameGroups : gameGroups;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "live", label: "Live", icon: <Radio className="h-4 w-4" />, count: liveCount },
    { id: "upcoming", label: "Upcoming", icon: <Clock className="h-4 w-4" /> },
    { id: "results", label: "Results", icon: <Trophy className="h-4 w-4" /> },
  ];

  return (
    <motion.div
      key="all-games"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
    >
      {/* Top-level tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === "live" && liveCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--live-glow)/0.15)] text-[hsl(var(--live-glow))] text-xs font-bold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--live-glow))] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[hsl(var(--live-glow))]" />
                </span>
                {liveCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Game groups */}
      <div className="space-y-8">
        {GAME_FILTERS.filter(g => g.id !== "all").map((game) => {
          const matches = displayGroups[game.id];
          if (!matches || matches.length === 0) return null;
          return (
            <div key={game.id}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{game.icon}</span>
                  <h2 className="text-xl font-bold text-foreground">{game.label}</h2>
                </div>
                <button
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => {
                    addXP(15);
                    navigate(`/esports/${game.id}`);
                  }}
                >
                  Full schedule
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} onWatchLive={onWatchLive} />
                ))}
              </div>
            </div>
          );
        })}
        {Object.values(displayGroups).every(v => !v || v.length === 0) && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No matches found</p>
            <p className="text-sm mt-1">Try selecting a different tab.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Game-Specific View — Live / Upcoming / Results tabs
   ═══════════════════════════════════════════════ */
function GameView({ gameId, onWatchLive }: { gameId: string; onWatchLive: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const game = GAME_FILTERS.find(g => g.id === gameId);

  const filteredMatches = useMemo(() => {
    let matches = ESPORTS_MATCHES.filter(m => m.gameTitle === gameId);
    if (activeTab === "live") return matches.filter(m => m.status === "live");
    if (activeTab === "upcoming") return matches.filter(m => m.status === "upcoming").sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return matches.filter(m => m.status === "completed").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeTab, gameId]);

  const liveCount = ESPORTS_MATCHES.filter(m => m.status === "live" && m.gameTitle === gameId).length;
  const showDateGroups = activeTab !== "live";
  const grouped = showDateGroups ? groupByDate(filteredMatches) : { "": filteredMatches };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "live", label: "Live", icon: <Radio className="h-4 w-4" />, count: liveCount },
    { id: "upcoming", label: "Upcoming", icon: <Clock className="h-4 w-4" /> },
    { id: "results", label: "Results", icon: <Trophy className="h-4 w-4" /> },
  ];

  return (
    <motion.div
      key={`game-${gameId}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Game header */}
      <div className="flex items-center gap-3 mb-5">
        <Link to="/esports">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="text-2xl">{game?.icon}</span>
        <h2 className="text-xl font-bold text-foreground">{game?.label}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.id === "live" && liveCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--live-glow)/0.15)] text-[hsl(var(--live-glow))] text-xs font-bold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--live-glow))] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[hsl(var(--live-glow))]" />
                </span>
                {liveCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Match list */}
      <AnimatePresence mode="wait">
        {filteredMatches.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No matches found</p>
            <p className="text-sm mt-1">Check back later for updates.</p>
          </motion.div>
        ) : (
          <motion.div key={`${activeTab}-${gameId}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {Object.entries(grouped).map(([dateLabel, matches]) => (
              <div key={dateLabel} className="mb-6">
                {dateLabel && (
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{dateLabel}</h3>
                )}
                <div className="grid gap-3">
                  {matches.map((match) => (
                    <MatchCard key={match.id} match={match} onWatchLive={onWatchLive} />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Main Esports Page
   ═══════════════════════════════════════════════ */
export default function Esports() {
  const { theme, toggleTheme } = useTheme();
  const { addXP } = useXP();
  const { gameId } = useParams<{ gameId?: string }>();
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState("all");
  const [activeTab, setActiveTab] = useState<TabType>("live");

  // Sync activeGame with route param
  useEffect(() => {
    if (gameId) {
      setActiveGame(gameId);
    } else {
      setActiveGame("all");
    }
  }, [gameId]);

  const handleGameFilter = (id: string) => {
    if (id === "all") {
      navigate("/esports");
    } else {
      addXP(10);
      navigate(`/esports/${id}`);
    }
  };

  const handleWatchLive = () => {
    addXP(25);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-[hsl(var(--nav-bg))] backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">
              Level<span className="text-primary">Up</span><span className="text-accent">XP</span>
            </span>
          </Link>
          <span className="text-muted-foreground hidden sm:inline">/ Esports Tracker</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-primary" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-4xl">
        {/* XP Bar */}
        <div className="mb-6">
          <XPProgressBar />
        </div>

        {/* Game Selector Bar */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin mb-2">
          {GAME_FILTERS.map((game) => (
            <motion.button
              key={game.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleGameFilter(game.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                activeGame === game.id
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              <span>{game.icon}</span>
              <span>{game.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeGame === "all" ? (
            <AllGamesView onWatchLive={handleWatchLive} activeTab={activeTab} setActiveTab={setActiveTab} />
          ) : (
            <GameView gameId={activeGame} onWatchLive={handleWatchLive} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
