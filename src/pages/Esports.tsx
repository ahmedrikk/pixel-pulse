import { useState, useMemo } from "react";
import { Radio, Clock, Trophy, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GAME_FILTERS } from "@/data/esportsData";
import { useEsportsMatches } from "@/hooks/useEsportsMatches";
import { SiteLayout } from "@/components/SiteLayout";
import type { EsportsMatch } from "@/lib/pandascore";
import { format, parseISO, differenceInSeconds, isToday, isTomorrow, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

type TabType = "live" | "upcoming" | "results";

const FALLBACK_LOGO = "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=64&h=64&fit=crop";

/* Map PandaScore game names to our filter IDs */
const GAME_SLUG_MAP: Record<string, string> = {
  "Counter-Strike": "cs2",
  "Counter-Strike 2": "cs2",
  "League of Legends": "lol",
  "Dota 2": "dota2",
  Valorant: "valorant",
  Overwatch: "overwatch",
  "Overwatch 2": "overwatch",
  "Rainbow Six Siege": "r6",
  "Call of Duty": "cod",
};

/* Map game to emoji icon */
const GAME_ICON_MAP: Record<string, string> = {
  cs2: "💣",
  lol: "⚔️",
  dota2: "🛡️",
  valorant: "🔫",
  overwatch: "🦸",
  r6: "🔒",
};

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
    if (!match.begin_at) continue;
    const label = getDateLabel(match.begin_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(match);
  }
  return groups;
}

/* ── Team Logo ── */
function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO; }} />
      ) : (
        <span className="text-lg font-bold text-muted-foreground">{name.charAt(0)}</span>
      )}
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
function TeamBlock({ name, image, score, isWinner, side }: {
  name: string;
  image: string | null;
  score: number;
  isWinner: boolean;
  side: "left" | "right";
}) {
  const align = side === "left" ? "text-right items-end" : "text-left items-start";
  return (
    <div className={`flex flex-col gap-1 flex-1 min-w-0 ${align}`}>
      <div className={`flex items-center gap-2 ${side === "left" ? "flex-row-reverse" : ""}`}>
        <TeamLogo src={image} name={name} />
        <span className={`text-sm font-bold truncate ${isWinner ? "text-[hsl(var(--gold))]" : "text-foreground"}`}>
          {name}
        </span>
      </div>
    </div>
  );
}

/* ── Match Card ── */
function MatchCard({ match }: { match: EsportsMatch }) {
  const gameSlug = GAME_SLUG_MAP[match.game] ?? "all";
  const gameIcon = GAME_ICON_MAP[gameSlug] ?? "🎮";
  const status = match.status;
  const isWinner1 = status === "finished" && match.score1 > match.score2;
  const isWinner2 = status === "finished" && match.score2 > match.score1;
  const formatLabel = match.numberOfGames ? `Bo${match.numberOfGames}` : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className={`group relative p-4 bg-card border rounded-xl transition-all duration-200 cursor-pointer hover:shadow-lg ${
        status === "running" ? "border-[hsl(var(--live-glow)/0.4)] neon-border" : "border-border hover:border-primary/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{gameIcon}</span>
          <span className="text-xs text-muted-foreground truncate">
            {match.league} · {match.tournament}{formatLabel && ` · ${formatLabel}`}
          </span>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {status === "running" && (
            <Badge className="bg-[hsl(var(--live-glow)/0.15)] text-[hsl(var(--live-glow))] border-[hsl(var(--live-glow)/0.3)] gap-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--live-glow))] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--live-glow))]" />
              </span>
              LIVE
            </Badge>
          )}
          {status === "finished" && (
            <Badge variant="secondary" className="text-muted-foreground text-xs">FT</Badge>
          )}
          {status === "not_started" && match.begin_at && (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              {format(parseISO(match.begin_at), "MMM d")}
            </Badge>
          )}
        </div>
      </div>

      {/* Face-off row */}
      <div className="flex items-center gap-3">
        <TeamBlock name={match.team1} image={match.team1Image} score={match.score1} isWinner={isWinner1} side="left" />

        {/* Score / Countdown center */}
        <div className="flex-shrink-0 w-24 flex flex-col items-center gap-1">
          {status === "running" && (
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-primary">{match.score1}</span>
              <span className="text-sm text-muted-foreground font-bold">:</span>
              <span className="text-2xl font-black text-primary">{match.score2}</span>
            </div>
          )}
          {status === "finished" && (
            <div className="flex items-center gap-1.5">
              <span className={`text-2xl font-black ${isWinner1 ? "text-[hsl(var(--gold))]" : "text-muted-foreground"}`}>
                {match.score1}
              </span>
              <span className="text-sm text-muted-foreground font-bold">:</span>
              <span className={`text-2xl font-black ${isWinner2 ? "text-[hsl(var(--gold))]" : "text-muted-foreground"}`}>
                {match.score2}
              </span>
            </div>
          )}
          {status === "not_started" && match.begin_at && (
            <Countdown timestamp={match.begin_at} />
          )}
        </div>

        <TeamBlock name={match.team2} image={match.team2Image} score={match.score2} isWinner={isWinner2} side="right" />
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {match.begin_at && <span>{format(parseISO(match.begin_at), "HH:mm")} UTC</span>}
        </div>
        {status === "running" && match.streamUrl && (
          <a href={match.streamUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" className="h-7 text-xs gap-1">
              <ExternalLink className="h-3 w-3" />
              Watch Live
            </Button>
          </a>
        )}
        {status === "not_started" && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Clock className="h-3 w-3" />
            Set Reminder
          </Button>
        )}
        {status === "finished" && (
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
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const [activeGame, setActiveGame] = useState("all");
  const { liveMatches, upcomingMatches, pastMatches, isLoading, error } = useEsportsMatches();

  const allMatches = useMemo(() => {
    if (activeTab === "live") return liveMatches;
    if (activeTab === "upcoming") return upcomingMatches;
    return pastMatches;
  }, [activeTab, liveMatches, upcomingMatches, pastMatches]);

  const filteredMatches = useMemo(() => {
    if (activeGame === "all") return allMatches;
    return allMatches.filter((m) => {
      const slug = GAME_SLUG_MAP[m.game];
      return slug === activeGame;
    });
  }, [allMatches, activeGame]);

  const liveCount = useMemo(() => {
    if (activeGame === "all") return liveMatches.length;
    return liveMatches.filter((m) => GAME_SLUG_MAP[m.game] === activeGame).length;
  }, [liveMatches, activeGame]);

  const showDateGroups = activeTab !== "live";
  const grouped = showDateGroups ? groupByDate(filteredMatches) : { "": filteredMatches };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "live", label: "Live", icon: <Radio className="h-4 w-4" />, count: liveCount },
    { id: "upcoming", label: "Upcoming", icon: <Clock className="h-4 w-4" /> },
    { id: "results", label: "Results", icon: <Trophy className="h-4 w-4" /> },
  ];

  return (
    <SiteLayout>
      <div>
        <h1 className="text-2xl font-black mb-6">
          Esports <span className="text-primary">Tracker</span>
        </h1>
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading matches...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">Failed to load matches</p>
            <p className="text-sm mt-1">{(error as Error).message}</p>
          </div>
        )}

        {/* Match List */}
        {!isLoading && !error && (
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
        )}
      </div>
    </SiteLayout>
  );
}
