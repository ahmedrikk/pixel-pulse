import { useState } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { toast } from "sonner";
import { useHypeMeter, type HypeGame, type SearchResult } from "@/hooks/useHypeMeter";
import { HypeSearch } from "./HypeSearch";
import { HypeSubmitModal } from "./HypeSubmitModal";

function formatVoteCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M votes`;
  if (count >= 1000) return `${Math.floor(count / 1000)}k votes`;
  return `${count} votes`;
}

// Ranks 1-3 have special colors, 4-6 use tertiary text color
const RANK_COLORS = ["#D97706", "#94A3B8", "#C2773E", "hsl(var(--muted-foreground))", "hsl(var(--muted-foreground))", "hsl(var(--muted-foreground))"];
const BAR_COLORS = ["#D97706", "#534AB7", "#0D9488", "hsl(var(--muted-foreground))", "hsl(var(--muted-foreground))", "hsl(var(--muted-foreground))"];

function HypeCard({ game }: { game: HypeGame }) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const { toggleVote, isVoting } = useHypeMeter();

  const handleHype = async () => {
    if (isVoting) return;
    if (!isAuthenticated) {
      openAuthModal("hub_hype" as never);
      return;
    }
    
    try {
      const justHyped = await toggleVote(game.id);
      if (justHyped) addXP(10);
    } catch (e) {
      toast.error("Failed to vote");
    }
  };

  const rankColor = RANK_COLORS[game.rank - 1] || "hsl(var(--muted-foreground))";
  const barColor = BAR_COLORS[game.rank - 1] || "hsl(var(--muted-foreground))";

  const trendEl = game.weeklyTrend > 0
    ? <span style={{ fontSize: 10, fontWeight: 500, color: "#16A34A" }}>↑ +{game.weeklyTrend}% this week</span>
    : game.weeklyTrend < 0
    ? <span style={{ fontSize: 10, fontWeight: 500, color: "#DC2626" }}>↓ {game.weeklyTrend}% this week</span>
    : <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>→ Stable</span>;

  return (
    <div style={{ background: "hsl(var(--card))", border: "0.5px solid hsl(var(--border))", borderRadius: 11, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      {/* Rank */}
      <span style={{ fontSize: 13, fontWeight: 500, minWidth: 18, textAlign: "center", color: rankColor }}>
        {game.rank}
      </span>

      {/* Cover */}
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: game.coverColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
      }}>
        {game.coverEmoji}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
          {game.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{game.releaseDate}</span>
          {trendEl}
        </div>
        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: "hsl(var(--border))", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${game.hypePercent}%`, background: barColor, borderRadius: 3, transition: "width 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 500, color: "hsl(var(--muted-foreground))", minWidth: 26, textAlign: "right" }}>
            {game.hypePercent}%
          </span>
        </div>
      </div>

      {/* Vote button */}
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <button
          onClick={handleHype}
          disabled={isVoting}
          style={{
            fontSize: 10, fontWeight: 500, padding: "5px 10px", borderRadius: 7,
            border: game.userHyped ? "0.5px solid #534AB7" : "0.5px solid hsl(var(--border))",
            background: game.userHyped ? "#EEEDFE" : "hsl(var(--secondary))",
            color: game.userHyped ? "#534AB7" : "hsl(var(--muted-foreground))",
            cursor: isVoting ? "not-allowed" : "pointer", 
            transition: "all 0.15s", display: "block", marginBottom: 4, width: "100%",
          }}
        >
          {game.userHyped ? "🔥 Hyped" : "Hype it"}
        </button>
        <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>
          {formatVoteCount(game.voteCount)}
        </span>
      </div>
    </div>
  );
}

export function HypeMeterSection() {
  const { topGames, isLoading, submitGame, isSubmitting } = useHypeMeter();
  const { addXP } = useXP();
  const [modalGame, setModalGame] = useState<SearchResult | null>(null);

  const handleSelectGame = (game: SearchResult) => {
    // Scroll to game if it's in the top 6
    const top6Game = topGames.find(g => g.igdbId === game.igdbId);
    if (top6Game) {
      toast("Game is in the top 6!", { description: "Vote for it directly." });
      // Real app: scroll into view
    } else {
      toast("Game is in the hype meter but not top 6.", { description: "You've hyped it!" });
    }
  };

  const handleOpenSubmit = (game: SearchResult) => {
    setModalGame(game);
  };

  const handleSubmit = async () => {
    if (!modalGame) return;
    try {
      await submitGame(modalGame);
      addXP(15);
      toast.success("✓ Submitted!", { description: `You're the first to hype ${modalGame.name}. +15 XP awarded` });
      setModalGame(null);
    } catch (e) {
      toast.error("Failed to submit game");
    }
  };

  return (
    <section style={{ padding: "18px 20px", paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "#D97706" }}>⚡</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>Community hype meter</span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", background: "hsl(var(--secondary))", padding: "2px 6px", borderRadius: 5 }}>
            Vote once per game
          </span>
        </div>
        <button style={{ fontSize: 11, color: "#534AB7", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap" }}>
          See all →
        </button>
      </div>

      <HypeSearch 
        onSelectGame={handleSelectGame} 
        onSubmitNewGame={handleOpenSubmit} 
      />

      {/* Game list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 68, background: "hsl(var(--secondary))", borderRadius: 11, animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
          ))
        ) : (
          topGames.map(game => (
            <HypeCard key={game.id} game={game} />
          ))
        )}
      </div>

      <HypeSubmitModal 
        game={modalGame} 
        isOpen={!!modalGame} 
        onClose={() => setModalGame(null)} 
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </section>
  );
}
