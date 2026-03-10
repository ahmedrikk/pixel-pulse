import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { TrendingUp, ArrowLeft, Radio, Clock, Trophy, ChevronRight, Calendar, X, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useXP } from "@/contexts/XPContext";
import { Sun, Moon } from "lucide-react";
import { type EsportsMatch } from "@/lib/pandascore";
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
import { format, isToday, isTomorrow, isYesterday, parseISO, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { XPProgressBar } from "@/components/XPProgressBar";

type TabType = "live" | "upcoming" | "results";

// ── Static metadata for known games ─────────────────────────────────────────
const GAME_META: Record<string, { label: string; icon: string }> = {
  "valorant":  { label: "Valorant",           icon: "🔫" },
  "cs2":       { label: "CS2",                icon: "💣" },
  "lol":       { label: "League of Legends",  icon: "⚔️" },
  "dota2":     { label: "Dota 2",             icon: "🛡️" },
  "overwatch": { label: "Overwatch 2",        icon: "🦸" },
  "r6":        { label: "Rainbow Six",        icon: "🔒" },
  "pubg":      { label: "PUBG",               icon: "🪖" },
  "cod":       { label: "Call of Duty",       icon: "🎯" },
  "apex":      { label: "Apex Legends",       icon: "🚀" },
  "rocket-league": { label: "Rocket League",  icon: "🚗" },
  "starcraft-2":   { label: "StarCraft II",   icon: "👾" },
  "hearthstone":   { label: "Hearthstone",    icon: "🃏" },
};

// Map PandaScore videogame names/slugs → normalized game id
const GAME_TO_ID: Record<string, string> = {
  // names (exactly as PandaScore returns)
  "valorant": "valorant",
  "counter-strike": "cs2",
  "counter-strike 2": "cs2",
  "lol": "lol",
  "league of legends": "lol",
  "dota 2": "dota2",
  "dota2": "dota2",
  "overwatch": "overwatch",
  "overwatch 2": "overwatch",
  "rainbow six siege": "r6",
  "r6": "r6",
  "pubg mobile": "pubg",
  "call of duty": "cod",
  "apex legends": "apex",
  "rocket league": "rocket-league",
  "starcraft ii": "starcraft-2",
  "starcraft 2": "starcraft-2",
  "hearthstone": "hearthstone",
  // slugs
  "cs-go": "cs2",
  "dota-2": "dota2",
  "overwatch-2": "overwatch",
  "league-of-legends": "lol",
  "rainbow-six-siege": "r6",
  "rocket-league": "rocket-league",
};

function getGameId(match: EsportsMatch): string {
  const byName = GAME_TO_ID[match.game.toLowerCase()];
  if (byName) return byName;
  const bySlug = GAME_TO_ID[match.gameSlug.toLowerCase()];
  if (bySlug) return bySlug;
  // Fall back to slug (e.g. "pubg-mobile")
  return match.gameSlug || match.game.toLowerCase().replace(/\s+/g, "-");
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
    const id = getGameId(match);
    if (!groups[id]) groups[id] = [];
    groups[id].push(match);
  }
  return groups;
}

// ── Twitch helpers ────────────────────────────────────────────────────────────
function extractTwitchChannel(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "twitch.tv" || u.hostname === "www.twitch.tv") {
      return u.pathname.replace(/^\//, "").split("/")[0] || null;
    }
  } catch {
    // ignore
  }
  return null;
}

// ── Twitch Embed Modal ────────────────────────────────────────────────────────
function TwitchModal({ match, onClose }: { match: EsportsMatch; onClose: () => void }) {
  const channel = match.streamUrl ? extractTwitchChannel(match.streamUrl) : null;
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <Badge className="bg-[hsl(var(--live-glow))] text-white border-transparent gap-1.5 text-xs font-bold flex-shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                LIVE
              </Badge>
              <span className="font-bold text-foreground truncate">
                {match.team1} vs {match.team2}
              </span>
              <span className="text-sm text-muted-foreground truncate hidden sm:block">
                {match.league}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Embed */}
          <div className="aspect-video bg-black">
            {channel ? (
              <iframe
                src={`https://player.twitch.tv/?channel=${channel}&parent=${hostname}&autoplay=true`}
                title={`${match.team1} vs ${match.team2} — Live`}
                className="w-full h-full"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Tv2 className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">Stream link not available</p>
                {match.streamUrl && (
                  <a
                    href={match.streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Open external stream
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
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
function MatchCard({
  match,
  gameFilters,
  onWatchLive,
}: {
  match: EsportsMatch;
  gameFilters: GameFilter[];
  onWatchLive: (match: EsportsMatch) => void;
}) {
  const gameId = getGameId(match);
  const gameFilter = gameFilters.find((g) => g.id === gameId);
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
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 font-bold rounded-lg"
            onClick={(e) => { e.stopPropagation(); onWatchLive(match); }}
          >
            <Tv2 className="h-3.5 w-3.5" />
            Watch Live
          </Button>
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

/* ── Game Filter type ── */
interface GameFilter {
  id: string;
  label: string;
  icon: string;
}

/* ═══════════════════════════════════════════════
   All Games View
   ═══════════════════════════════════════════════ */
interface AllGamesViewProps {
  liveMatches: EsportsMatch[];
  upcomingMatches: EsportsMatch[];
  pastMatches: EsportsMatch[];
  isLoading: boolean;
  gameFilters: GameFilter[];
  onWatchLive: (match: EsportsMatch) => void;
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
}

function AllGamesView({ liveMatches, upcomingMatches, pastMatches, isLoading, gameFilters, onWatchLive, activeTab, setActiveTab }: AllGamesViewProps) {
  const navigate = useNavigate();
  const { addXP } = useXP();

  const liveCount = liveMatches.length;

  const filteredByTab = useMemo(() => {
    if (activeTab === "upcoming") return [...upcomingMatches].sort((a, b) => new Date(a.begin_at ?? 0).getTime() - new Date(b.begin_at ?? 0).getTime());
    if (activeTab === "results") return [...pastMatches].sort((a, b) => new Date(b.begin_at ?? 0).getTime() - new Date(a.begin_at ?? 0).getTime());
    return liveMatches;
  }, [activeTab, liveMatches, upcomingMatches, pastMatches]);

  const gameGroups = useMemo(() => groupByGame(filteredByTab), [filteredByTab]);

  // For "live" tab: show live matches per game, backfill with upcoming then completed
  const liveGameGroups = useMemo(() => {
    if (activeTab !== "live") return {};
    const groups: Record<string, EsportsMatch[]> = {};
    const upcomingByGame = groupByGame([...upcomingMatches].sort((a, b) => new Date(a.begin_at ?? 0).getTime() - new Date(b.begin_at ?? 0).getTime()));
    const completedByGame = groupByGame([...pastMatches].sort((a, b) => new Date(b.begin_at ?? 0).getTime() - new Date(a.begin_at ?? 0).getTime()));

    // Collect all game IDs that have ANY match data
    const activeGameIds = new Set<string>();
    for (const m of [...liveMatches, ...upcomingMatches, ...pastMatches]) {
      activeGameIds.add(getGameId(m));
    }

    for (const game of gameFilters.filter(g => g.id !== "all")) {
      if (!activeGameIds.has(game.id)) continue;
      const live = liveMatches.filter(m => getGameId(m) === game.id);
      const cards = [...live];
      if (cards.length < 2) {
        cards.push(...(upcomingByGame[game.id] || []).slice(0, 2 - cards.length));
      }
      if (cards.length < 2) {
        cards.push(...(completedByGame[game.id] || []).slice(0, 2 - cards.length));
      }
      if (cards.length > 0) groups[game.id] = cards.slice(0, 2);
    }
    return groups;
  }, [activeTab, liveMatches, upcomingMatches, pastMatches, gameFilters]);

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
        {gameFilters.filter(g => g.id !== "all").map((game) => {
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
                  <MatchCard key={match.id} match={match} gameFilters={gameFilters} onWatchLive={onWatchLive} />
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
  gameFilters: GameFilter[];
  onWatchLive: (match: EsportsMatch) => void;
}

function GameView({ gameId, liveMatches, upcomingMatches, pastMatches, gameFilters, onWatchLive }: GameViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const game = gameFilters.find(g => g.id === gameId);

  const allForGame = useMemo(() => (
    [...liveMatches, ...upcomingMatches, ...pastMatches].filter(m => getGameId(m) === gameId)
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
        <span className="text-2xl">{game?.icon ?? "🎮"}</span>
        <h2 className="text-xl font-bold text-foreground">{game?.label ?? gameId}</h2>
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
                    <MatchCard key={match.id} match={match} gameFilters={gameFilters} onWatchLive={onWatchLive} />
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
  const [watchingMatch, setWatchingMatch] = useState<EsportsMatch | null>(null);

  const { liveMatches, upcomingMatches, pastMatches, isLoading, error } = useEsportsMatches();

  // Sync activeGame with route param
  useEffect(() => {
    if (gameId) {
      setActiveGame(gameId);
    } else {
      setActiveGame("all");
    }
  }, [gameId]);

  // Derive game filters dynamically from actual match data
  const gameFilters: GameFilter[] = useMemo(() => {
    const seen = new Map<string, GameFilter>();
    for (const m of [...liveMatches, ...upcomingMatches, ...pastMatches]) {
      const id = getGameId(m);
      if (!seen.has(id)) {
        const meta = GAME_META[id];
        seen.set(id, {
          id,
          label: meta?.label ?? m.game,
          icon: meta?.icon ?? "🎮",
        });
      }
    }
    return [
      { id: "all", label: "All Games", icon: "🎮" },
      ...Array.from(seen.values()),
    ];
  }, [liveMatches, upcomingMatches, pastMatches]);

  const handleGameFilter = (id: string) => {
    if (id === "all") {
      navigate("/esports");
    } else {
      addXP(10);
      navigate(`/esports/${id}`);
    }
  };

  const handleWatchLive = (match: EsportsMatch) => {
    addXP(25);
    setWatchingMatch(match);
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

        {/* Game Selector Bar — derived from live data */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin mb-2">
          {gameFilters.map((game) => (
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
              gameFilters={gameFilters}
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
              gameFilters={gameFilters}
              onWatchLive={handleWatchLive}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Twitch Embed Modal */}
      <AnimatePresence>
        {watchingMatch && (
          <TwitchModal match={watchingMatch} onClose={() => setWatchingMatch(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
