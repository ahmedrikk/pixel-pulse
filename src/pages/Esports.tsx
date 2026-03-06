import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, ArrowLeft, Radio, Clock, Trophy, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { GAME_FILTERS, ESPORTS_MATCHES, type EsportsMatch, type EsportsTeam } from "@/data/esportsData";
import { format, isToday, isTomorrow, isYesterday, parseISO, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="w-full flex items-center gap-2 text-[10px] font-semibold">
      <span className="text-primary w-8 text-right">{teamA.probability}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-secondary flex">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${teamA.probability}%` }}
        />
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${teamB.probability}%` }}
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
    <div className={`flex flex-col gap-1 flex-1 min-w-0 ${align}`}>
      <div className={`flex items-center gap-2 ${side === "left" ? "flex-row-reverse" : ""}`}>
        <span className="text-2xl flex-shrink-0">{team.logo}</span>
        <div className={`min-w-0 ${align}`}>
          <div className={`flex items-center gap-1.5 ${side === "left" ? "flex-row-reverse" : ""}`}>
            <span className={`text-sm font-bold truncate ${isWinner ? "text-[hsl(var(--gold))]" : "text-foreground"}`}>
              {team.name}
            </span>
            <span className="text-xs flex-shrink-0">{team.flag}</span>
          </div>
          <FormDots form={team.form} />
        </div>
      </div>
    </div>
  );
}

/* ── Match Card ── */
function MatchCard({ match }: { match: EsportsMatch }) {
  const gameFilter = GAME_FILTERS.find((g) => g.id === match.gameTitle);
  const isWinnerA = match.status === "completed" && (match.scoreA ?? 0) > (match.scoreB ?? 0);
  const isWinnerB = match.status === "completed" && (match.scoreB ?? 0) > (match.scoreA ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className={`group relative p-4 bg-card border rounded-xl transition-all duration-200 cursor-pointer hover:shadow-lg ${
        match.status === "live" ? "border-[hsl(var(--live-glow)/0.4)] neon-border" : "border-border hover:border-primary/30"
      }`}
    >
      {/* Header row: game icon + tournament + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{gameFilter?.icon || "🎮"}</span>
          <span className="text-xs text-muted-foreground truncate">
            {match.leagueName} · {match.format}
          </span>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {match.status === "live" && (
            <Badge className="bg-[hsl(var(--live-glow)/0.15)] text-[hsl(var(--live-glow))] border-[hsl(var(--live-glow)/0.3)] gap-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--live-glow))] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--live-glow))]" />
              </span>
              LIVE
            </Badge>
          )}
          {match.status === "completed" && (
            <Badge variant="secondary" className="text-muted-foreground text-xs">FT</Badge>
          )}
          {match.status === "upcoming" && (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              {format(parseISO(match.timestamp), "MMM d")}
            </Badge>
          )}
        </div>
      </div>

      {/* Face-off row */}
      <div className="flex items-center gap-3">
        <TeamBlock team={match.teamA} score={match.scoreA} isWinner={isWinnerA} side="left" />

        {/* Score / Countdown center */}
        <div className="flex-shrink-0 w-24 flex flex-col items-center gap-1">
          {match.status === "live" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-primary">{match.scoreA}</span>
                <span className="text-sm text-muted-foreground font-bold">:</span>
                <span className="text-2xl font-black text-primary">{match.scoreB}</span>
              </div>
            </>
          )}
          {match.status === "completed" && (
            <div className="flex items-center gap-1.5">
              <span className={`text-2xl font-black ${isWinnerA ? "text-[hsl(var(--gold))]" : "text-muted-foreground"}`}>
                {match.scoreA}
              </span>
              <span className="text-sm text-muted-foreground font-bold">:</span>
              <span className={`text-2xl font-black ${isWinnerB ? "text-[hsl(var(--gold))]" : "text-muted-foreground"}`}>
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
      <div className="mt-3">
        <ProbabilityBar teamA={match.teamA} teamB={match.teamB} />
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{format(parseISO(match.timestamp), "HH:mm")} UTC</span>
        </div>
        {match.status === "live" && match.streamUrl && (
          <a href={match.streamUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" className="h-7 text-xs gap-1">
              <ExternalLink className="h-3 w-3" />
              Watch Live
            </Button>
          </a>
        )}
        {match.status === "upcoming" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Clock className="h-3 w-3" />
            Set Reminder
          </Button>
        )}
        {match.status === "completed" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground">
            Match Details
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function Esports() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const [activeGame, setActiveGame] = useState("all");

  const filteredMatches = useMemo(() => {
    let matches = ESPORTS_MATCHES;
    if (activeGame !== "all") {
      matches = matches.filter((m) => m.gameTitle === activeGame);
    }
    if (activeTab === "live") return matches.filter((m) => m.status === "live");
    if (activeTab === "upcoming") return matches.filter((m) => m.status === "upcoming").sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return matches.filter((m) => m.status === "completed").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeTab, activeGame]);

  const liveCount = ESPORTS_MATCHES.filter((m) => m.status === "live" && (activeGame === "all" || m.gameTitle === activeGame)).length;

  const showDateGroups = activeTab !== "live";
  const grouped = showDateGroups ? groupByDate(filteredMatches) : { "": filteredMatches };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "live", label: "Live", icon: <Radio className="h-4 w-4" />, count: liveCount },
    { id: "upcoming", label: "Upcoming", icon: <Clock className="h-4 w-4" /> },
    { id: "results", label: "Results", icon: <Trophy className="h-4 w-4" /> },
  ];

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
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5 text-primary" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-4xl">
        {/* Game Filter Bar */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin mb-2">
          {GAME_FILTERS.map((game) => (
            <motion.button
              key={game.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveGame(game.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
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

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
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

        {/* Match List */}
        <AnimatePresence mode="wait">
          {filteredMatches.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16 text-muted-foreground"
            >
              <p className="text-lg font-medium">No matches found</p>
              <p className="text-sm mt-1">Try selecting a different game or tab.</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeTab}-${activeGame}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {Object.entries(grouped).map(([dateLabel, matches]) => (
                <div key={dateLabel} className="mb-6">
                  {dateLabel && (
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                      {dateLabel}
                    </h3>
                  )}
                  <div className="grid gap-3">
                    {matches.map((match) => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
