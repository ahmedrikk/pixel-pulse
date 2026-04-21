import { useState } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";

interface HypeGame {
  id: string;
  rank: number;
  name: string;
  coverEmoji: string;
  coverColor: string;
  coverUrl: string | null;
  releaseDate: string;
  hypePercent: number;
  weeklyTrend: number;
  voteCount: number;
  userHyped: boolean;
}

function formatVoteCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M votes`;
  if (count >= 1000) return `${Math.floor(count / 1000)}k votes`;
  return `${count} votes`;
}

const RANK_COLORS = ["#D97706", "#94A3B8", "#C2773E"];
const BAR_COLORS = ["#D97706", "#534AB7", "#0D9488", "#D85A30"];

const MOCK_GAMES: HypeGame[] = [
  { id: "gta6", rank: 1, name: "GTA 6", coverEmoji: "🌴", coverColor: "#1a0a0a", coverUrl: null, releaseDate: "Fall 2025", hypePercent: 94, weeklyTrend: 12, voteCount: 487291, userHyped: false },
  { id: "es6", rank: 2, name: "Elder Scrolls VI", coverEmoji: "⚔️", coverColor: "#0a1015", coverUrl: null, releaseDate: "TBA", hypePercent: 71, weeklyTrend: 3, voteCount: 312048, userHyped: false },
  { id: "silksong", rank: 3, name: "Hollow Knight: Silksong", coverEmoji: "🐝", coverColor: "#050a0f", coverUrl: null, releaseDate: "2025", hypePercent: 58, weeklyTrend: -2, voteCount: 241807, userHyped: false },
  { id: "cod25", rank: 4, name: "Call of Duty 2025", coverEmoji: "🎯", coverColor: "#0f0800", coverUrl: null, releaseDate: "Holiday 2025", hypePercent: 42, weeklyTrend: 0, voteCount: 178334, userHyped: true },
];

function HypeCard({ game }: { game: HypeGame }) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const [state, setState] = useState({ hypePercent: game.hypePercent, voteCount: game.voteCount, userHyped: game.userHyped });

  const handleHype = () => {
    if (!isAuthenticated) {
      openAuthModal("hub_hype" as never);
      return;
    }
    const wasHyped = state.userHyped;
    setState(prev => ({
      hypePercent: wasHyped ? prev.hypePercent - 1 : Math.min(prev.hypePercent + 1, 100),
      voteCount: wasHyped ? prev.voteCount - 1 : prev.voteCount + 1,
      userHyped: !wasHyped,
    }));
    if (!wasHyped) addXP(10);
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
            <div style={{ height: "100%", width: `${state.hypePercent}%`, background: barColor, borderRadius: 3, transition: "width 0.3s ease" }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 500, color: "hsl(var(--muted-foreground))", minWidth: 26, textAlign: "right" }}>
            {state.hypePercent}%
          </span>
        </div>
      </div>

      {/* Vote button */}
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <button
          onClick={handleHype}
          style={{
            fontSize: 10, fontWeight: 500, padding: "5px 10px", borderRadius: 7,
            border: state.userHyped ? "0.5px solid #534AB7" : "0.5px solid hsl(var(--border))",
            background: state.userHyped ? "#EEEDFE" : "hsl(var(--secondary))",
            color: state.userHyped ? "#534AB7" : "hsl(var(--muted-foreground))",
            cursor: "pointer", transition: "all 0.15s", display: "block", marginBottom: 4, width: "100%",
          }}
        >
          {state.userHyped ? "🔥 Hyped" : "Hype it"}
        </button>
        <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>
          {formatVoteCount(state.voteCount)}
        </span>
      </div>
    </div>
  );
}

export function HypeMeterSection() {
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

      {/* Game list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MOCK_GAMES.map(game => (
          <HypeCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}
