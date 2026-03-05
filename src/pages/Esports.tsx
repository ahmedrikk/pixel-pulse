import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, ArrowLeft, Radio, Clock, Trophy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { GAME_FILTERS, ESPORTS_MATCHES, type EsportsMatch } from "@/data/esportsData";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

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

function MatchCard({ match }: { match: EsportsMatch }) {
  const gameFilter = GAME_FILTERS.find((g) => g.id === match.gameTitle);

  return (
    <div className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-card border border-border rounded-lg hover:border-primary/40 transition-all duration-200 cursor-pointer">
      {/* Game icon */}
      <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-lg flex-shrink-0">
        {gameFilter?.icon || "🎮"}
      </div>

      {/* Tournament info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate mb-1">
          {match.leagueName} · {match.format}
        </p>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Team A */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <span className="text-sm font-semibold truncate">{match.teamA.name}</span>
            <span className="text-lg flex-shrink-0">{match.teamA.logo}</span>
          </div>

          {/* Score / Time */}
          <div className="flex-shrink-0 w-20 text-center">
            {match.status === "live" && (
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold text-primary">{match.scoreA}</span>
                <span className="text-xs text-muted-foreground">-</span>
                <span className="text-lg font-bold text-primary">{match.scoreB}</span>
              </div>
            )}
            {match.status === "completed" && (
              <div className="flex items-center justify-center gap-1">
                <span className={`text-lg font-bold ${(match.scoreA ?? 0) > (match.scoreB ?? 0) ? "text-foreground" : "text-muted-foreground"}`}>
                  {match.scoreA}
                </span>
                <span className="text-xs text-muted-foreground">-</span>
                <span className={`text-lg font-bold ${(match.scoreB ?? 0) > (match.scoreA ?? 0) ? "text-foreground" : "text-muted-foreground"}`}>
                  {match.scoreB}
                </span>
              </div>
            )}
            {match.status === "upcoming" && (
              <span className="text-sm font-medium text-muted-foreground">
                {format(parseISO(match.timestamp), "HH:mm")}
              </span>
            )}
          </div>

          {/* Team B */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-lg flex-shrink-0">{match.teamB.logo}</span>
            <span className="text-sm font-semibold truncate">{match.teamB.name}</span>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 hidden sm:block">
        {match.status === "live" && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            LIVE
          </Badge>
        )}
        {match.status === "completed" && (
          <Badge variant="secondary" className="text-muted-foreground">FT</Badge>
        )}
        {match.status === "upcoming" && (
          <Badge variant="outline" className="text-muted-foreground">
            {format(parseISO(match.timestamp), "MMM d")}
          </Badge>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
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
      <header className="sticky top-0 z-50 border-b border-border bg-nav backdrop-blur-sm">
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
            <button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                activeGame === game.id
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              <span>{game.icon}</span>
              <span>{game.label}</span>
            </button>
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
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-bold">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                  </span>
                  {liveCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Match List */}
        {Object.keys(grouped).length === 0 || filteredMatches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No matches found</p>
            <p className="text-sm mt-1">Try selecting a different game or tab.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, matches]) => (
            <div key={dateLabel} className="mb-6">
              {dateLabel && (
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  {dateLabel}
                </h3>
              )}
              <div className="space-y-2">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
