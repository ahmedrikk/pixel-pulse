import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { TrendingUp, ArrowLeft, Radio, Clock, Trophy, ChevronRight, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useXP } from "@/contexts/XPContext";
import { Sun, Moon } from "lucide-react";
import { GAME_FILTERS } from "@/data/esportsData";
import { type EsportsMatch } from "@/lib/pandascore";
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
import { format, isToday, isTomorrow, isYesterday, parseISO, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { XPProgressBar } from "@/components/XPProgressBar";

type TabType = "live" | "upcoming" | "results";

// Map PandaScore videogame slugs to GAME_FILTERS ids
const SLUG_TO_FILTER_ID: Record<string, string> = {
  valorant: "valorant",
  "cs-go": "cs2",
  cs2: "cs2",
  "league-of-legends": "lol",
  "dota-2": "dota2",
  "overwatch-2": "overwatch",
  "rainbow-six-siege": "r6",
};

function getFilterId(gameSlug: string): string {
  return SLUG_TO_FILTER_ID[gameSlug] ?? gameSlug;
}

function getMatchStatus(m: EsportsMatch): "live" | "upcoming" | "completed" {
  if (m.status === "running") return "live";
  if (m.status === "finished") return "completed";
  return "upcoming";
}

function getDateLabel(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return `Tomorrow, ${format(date, "MMMM do")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "MMMM do")}`;
  return format(date, "EEEE, MMMM do");
}

function groupByDate(matches: EsportsMatch[]): Record<string, EsportsMatch[]> {
  const groups: Record<string, EsportsMatch[]> = {};
  for (const match of matches) {
    const label = getDateLabel(match.begin_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(match);
  }
  return groups;
}

function groupByGame(matches: EsportsMatch[]): Record<string, EsportsMatch[]> {
  const groups: Record<string, EsportsMatch[]> = {};
  for (const match of matches) {
    const gameId = getFilterId(match.game);
    if (!groups[gameId]) groups[gameId] = [];
    groups[gameId].push(match);
  }
  return groups;
}

/* ── Countdown ── */
function Countdown({ timestamp }: { timestamp: string | null }) {
  if (!timestamp) return <span className="text-sm text-muted-foreground">TBD</span>;
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
function TeamBlock({ name, imageUrl, isWinner, side }: { name: string; imageUrl: string | null; isWinner: boolean; side: "left" | "right" }) {
  const align = side === "left" ? "text-right items-end" : "text-left items-start";
  return (
    <div className={`flex flex-col gap-1.5 flex-1 min-w-0 ${align}`}>
      <div className={`flex items-center gap-3 ${side === "left" ? "flex-row-reverse" : ""}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-8 h-8 rounded object-contain flex-shrink-0 bg-secondary" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-xs font-bold flex-shrink-0 text-foreground">
            {name[0] ?? "?"}
          </div>
        )}
        <span className={`text-sm font-bold truncate ${isWinner ? "text-[hsl(var(--gold))]" : "text-foreground"}`}>
          {name}
        </span>
      </div>
    </div>
  );
}

/* ── Match Card ── */
function MatchCard({ match, onWatchLive }: { match: EsportsMatch; onWatchLive?: () => void }) {
  const gameFilterId = getFilterId(match.game);
  const gameFilter = GAME_FILTERS.find((g) => g.id === gameFilterId);
  const status = getMatchStatus(match);
  const isWinner1 = status === "completed" && match.score1 > match.score2;
  const isWinner2 = status === "completed" && match.score2 > match.score1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className={`group relative p-5 bg-card border rounded-2xl transition-all duration-200 hover:shadow-lg card-shadow ${
        status === "live" ? "border-[hsl(var(--live-glow)/0.3)] shadow-[0_0_20px_-5px_hsl(var(--live-glow)/0.15)]" : "border-border hover:border-primary/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{gameFilter?.icon || "🎮"}</span>
          <span className="text-xs font-medium text-muted-foreground truncate">
            {match.league} · {match.numberOfGames ? `Bo${match.numberOfGames}` : "Match"}
          </span>
        </div>
        <div className="flex-shrink-0">
          {status === "live" && (
            <Badge className="bg-[hsl(var(--live-glow))] text-[hsl(0,0%,100%)] border-transparent gap-1.5 text-xs font-bold px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(0,0%,100%)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(0,0%,100%)]" />
              </span>
              LIVE
            </Badge>
          )}
          {status === "completed" && (
            <Badge variant="secondary" className="text-muted-foreground text-xs font-bold">FINAL</Badge>
          )}
          {status === "upcoming" && match.begin_at && (
            <Badge variant="outline" className="text-muted-foreground text-xs font-medium gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(match.begin_at), "MMM d")}
            </Badge>
          )}
        </div>
      </div>

      {/* Face-off */}
      <div className="flex items-center gap-3">
        <TeamBlock name={match.team1} imageUrl={match.team1Image} isWinner={isWinner1} side="left" />

        {/* Score center */}
        <div className="flex-shrink-0 w-24 flex flex-col items-center gap-1">
          {(status === "live" || status === "completed") && (
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black ${
                status === "live" ? "text-primary" : isWinner1 ? "text-[hsl(var(--gold))]" : "text-muted-foreground"
              }`}>
                {match.score1}
              </span>
              <span className="text-lg text-muted-foreground font-bold">:</span>
              <span className={`text-3xl font-black ${
                status === "live" ? "text-primary" : isWinner2 ? "text-[hsl(var(--gold))]" : "text-muted-foreground"
              }`}>
                {match.score2}
              </span>
            </div>
          )}
          {status === "upcoming" && (
            <Countdown timestamp={match.begin_at} />
          )}
        </div>

        <TeamBlock name={match.team2} imageUrl={match.team2Image} isWinner={isWinner2} side="right" />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {match.begin_at ? format(parseISO(match.begin_at), "HH:mm") + " UTC" : "TBD"}
        </span>
        {status === "live" && match.streamUrl && (
          <a href={match.streamUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); onWatchLive?.(); }}>
            <Button size="sm" className="h-8 text-xs gap-1.5 font-bold rounded-lg">
              <ExternalLink className="h-3.5 w-3.5" />
              Watch Live
            </Button>
          </a>
        )}
        {status === "upcoming" && (
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-lg">
            <Clock className="h-3.5 w-3.5" />
            Set Reminder
          </Button>
        )}
        {status === "completed" && (
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
   All Games View
   ═══════════════════════════════════════════════ */
interface AllGamesViewProps {
  liveMatches: EsportsMatch[];
  upcomingMatches: EsportsMatch[];
  pastMatches: EsportsMatch[];
  isLoading: boolean;
  onWatchLive: () => void;
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
}

function AllGamesView({ liveMatches, upcomingMatches, pastMatches, isLoading, onWatchLive, activeTab, setActiveTab }: AllGamesViewProps) {
  const navigate = useNavigate();
  const { addXP } = useXP();

  const liveCount = liveMatches.length;

  const filteredByTab = useMemo(() => {
    if (activeTab === "upcoming") return [...upcomingMatches].sort((a, b) => new Date(a.begin_at ?? 0).getTime() - new Date(b.begin_at ?? 0).getTime());
    if (activeTab === "results") return [...pastMatches].sort((a, b) => new Date(b.begin_at ?? 0).getTime() - new Date(a.begin_at ?? 0).getTime());
    return liveMatches;
  }, [activeTab, liveMatches, upcomingMatches, pastMatches]);

  const gameGroups = useMemo(() => groupByGame(filteredByTab), [filteredByTab]);

  // For "live" tab: backfill with recent completed when < 2 live per game
  const liveGameGroups = useMemo(() => {
    if (activeTab !== "live") return {};
    const groups: Record<string, EsportsMatch[]> = {};
    const completedByGame = groupByGame([...pastMatches].sort((a, b) => new Date(b.begin_at ?? 0).getTime() - new Date(a.begin_at ?? 0).getTime()));
    for (const game of GAME_FILTERS.filter(g => g.id !== "all")) {
      const live = liveMatches.filter(m => getFilterId(m.game) === game.id);
      if (live.length === 0) continue;
      const cards = [...live];
      if (cards.length < 2) {
        const backfill = (completedByGame[game.id] || []).slice(0, 2 - cards.length);
        cards.push(...backfill);
      }
      groups[game.id] = cards.slice(0, 2);
    }
    return groups;
  }, [activeTab, liveMatches, pastMatches]);

  const displayGroups = activeTab === "live" ? liveGameGroups : gameGroups;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "live", label: "Live", icon: <Radio className="h-4 w-4" />, count: liveCount },
    { id: "upcoming", label: "Upcoming", icon: <Clock className="h-4 w-4" /> },
    { id: "results", label: "Results", icon: <Trophy className="h-4 w-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

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
            <p className="text-sm mt-1">
              {activeTab === "live" ? "No live matches right now — check Upcoming." : "Try selecting a different tab."}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Game-Specific View
   ═══════════════════════════════════════════════ */
interface GameViewProps {
  gameId: string;
  liveMatches: EsportsMatch[];
  upcomingMatches: EsportsMatch[];
  pastMatches: EsportsMatch[];
  onWatchLive: () => void;
}

function GameView({ gameId, liveMatches, upcomingMatches, pastMatches, onWatchLive }: GameViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const game = GAME_FILTERS.find(g => g.id === gameId);

  const allForGame = useMemo(() => (
    [...liveMatches, ...upcomingMatches, ...pastMatches].filter(m => getFilterId(m.game) === gameId)
  ), [gameId, liveMatches, upcomingMatches, pastMatches]);

  const filteredMatches = useMemo(() => {
    if (activeTab === "live") return allForGame.filter(m => getMatchStatus(m) === "live");
    if (activeTab === "upcoming") return allForGame.filter(m => getMatchStatus(m) === "upcoming").sort((a, b) => new Date(a.begin_at ?? 0).getTime() - new Date(b.begin_at ?? 0).getTime());
    return allForGame.filter(m => getMatchStatus(m) === "completed").sort((a, b) => new Date(b.begin_at ?? 0).getTime() - new Date(a.begin_at ?? 0).getTime());
  }, [activeTab, allForGame]);

  const liveCount = allForGame.filter(m => getMatchStatus(m) === "live").length;
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

  const { liveMatches, upcomingMatches, pastMatches, isLoading, error } = useEsportsMatches();

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

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm text-center">
            Could not load matches. PandaScore may be rate-limited.
          </div>
        )}

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
            <AllGamesView
              liveMatches={liveMatches}
              upcomingMatches={upcomingMatches}
              pastMatches={pastMatches}
              isLoading={isLoading}
              onWatchLive={handleWatchLive}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          ) : (
            <GameView
              gameId={activeGame}
              liveMatches={liveMatches}
              upcomingMatches={upcomingMatches}
              pastMatches={pastMatches}
              onWatchLive={handleWatchLive}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
