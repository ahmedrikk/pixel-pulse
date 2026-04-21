import { useState } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";
import { toast } from "sonner";

interface LinkedArticle {
  headline: string;
  source: string;
  publishedAt: Date;
  originalUrl: string;
  thumbnailEmoji: string;
  thumbnailUrl: string | null;
}

interface HotTake {
  id: string;
  userId: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  currentTier: number;
  gameTag: string;
  text: string;
  linkedArticle: LinkedArticle | null;
  agreeCount: number;
  disagreeCount: number;
  userVote: "agree" | "disagree" | null;
  createdAt: Date;
}

const GAME_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Valorant":       { bg: "#FEF2F2", text: "#991B1B" },
  "GTA 6":          { bg: "#EEEDFE", text: "#3C3489" },
  "Hollow Knight":  { bg: "#EAF3DE", text: "#166534" },
  "CS2":            { bg: "#FEF2F2", text: "#991B1B" },
  "Elden Ring":     { bg: "#FAEEDA", text: "#633806" },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const MOCK_TAKES: HotTake[] = [
  {
    id: "t1", userId: "u1", username: "@axelgaming", avatarInitials: "AX", avatarColor: "#534AB7", currentTier: 18,
    gameTag: "Valorant",
    text: "Episode 8 Act 2 is the best update Valorant has had in years. The map rotations finally feel fresh and the Agent balance changes actually make sense. Riot is on a completely different level right now.",
    linkedArticle: {
      headline: "Valorant Episode 8 Act 2 patch notes — new map pool and balance changes detailed",
      source: "Dot Esports", publishedAt: new Date(Date.now() - 3600000),
      originalUrl: "https://dotesports.com", thumbnailEmoji: "🔫", thumbnailUrl: null,
    },
    agreeCount: 2847, disagreeCount: 341, userVote: null, createdAt: new Date(Date.now() - 7200000),
  },
  {
    id: "t2", userId: "u2", username: "@nova_fps", avatarInitials: "NF", avatarColor: "#0D9488", currentTier: 12,
    gameTag: "GTA 6",
    text: "Anyone else think GTA 6 is going to miss the Fall 2025 window? The lack of gameplay footage this close to launch is a red flag. Rockstar will delay again, calling it now.",
    linkedArticle: {
      headline: "GTA 6 reportedly still on track for Fall 2025 despite silence from Rockstar",
      source: "IGN", publishedAt: new Date(Date.now() - 7200000),
      originalUrl: "https://ign.com", thumbnailEmoji: "🚗", thumbnailUrl: null,
    },
    agreeCount: 1204, disagreeCount: 876, userVote: null, createdAt: new Date(Date.now() - 10800000),
  },
  {
    id: "t3", userId: "u3", username: "@stormrift", avatarInitials: "SR", avatarColor: "#D97706", currentTier: 9,
    gameTag: "Elden Ring",
    text: "Elden Ring DLC difficulty was completely overtuned at launch. The base game was perfect — the DLC felt like they forgot what made it great. Still a masterpiece but the final boss is just unfair.",
    linkedArticle: null,
    agreeCount: 3912, disagreeCount: 1508, userVote: null, createdAt: new Date(Date.now() - 86400000),
  },
];

function TakeCard({ take }: { take: HotTake }) {
  const { isAuthenticated, openAuthModal } = useAuthGate();
  const { addXP } = useXP();
  const [votes, setVotes] = useState({ agree: take.agreeCount, disagree: take.disagreeCount, userVote: take.userVote });

  const handleVote = (type: "agree" | "disagree") => {
    if (!isAuthenticated) {
      openAuthModal("hub_vote" as never);
      return;
    }
    setVotes(prev => {
      const wasVotingFor = prev.userVote === type;
      return {
        agree: type === "agree" ? (prev.agree + (wasVotingFor ? -1 : prev.userVote === "disagree" ? 1 : 1)) : (prev.agree + (prev.userVote === "agree" ? -1 : 0)),
        disagree: type === "disagree" ? (prev.disagree + (wasVotingFor ? -1 : prev.userVote === "agree" ? 1 : 1)) : (prev.disagree + (prev.userVote === "disagree" ? -1 : 0)),
        userVote: wasVotingFor ? null : type,
      };
    });
    if (!votes.userVote) addXP(5);
  };

  const gameColor = GAME_TAG_COLORS[take.gameTag] || { bg: "hsl(var(--secondary))", text: "hsl(var(--muted-foreground))" };

  return (
    <div style={{ background: "hsl(var(--card))", border: "0.5px solid hsl(var(--border))", borderRadius: 12, padding: "13px 15px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: take.avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 500, color: "#fff", flexShrink: 0,
        }}>
          {take.avatarInitials}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 1 }}>{take.username}</p>
          <p style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>Tier {take.currentTier} · {timeAgo(take.createdAt)}</p>
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 5, background: gameColor.bg, color: gameColor.text, flexShrink: 0 }}>
          {take.gameTag}
        </span>
      </div>

      {/* Text */}
      <p style={{ fontSize: 12, color: "hsl(var(--foreground))", lineHeight: 1.6, marginBottom: 10 }}>
        {take.text}
      </p>

      {/* Linked Article */}
      {take.linkedArticle && (
        <a
          href={take.linkedArticle.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 11px",
            background: "hsl(var(--secondary))", border: "0.5px solid hsl(var(--border))",
            borderRadius: 9, marginBottom: 10, cursor: "pointer", textDecoration: "none",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#534AB7")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
        >
          <div style={{
            width: 42, height: 34, borderRadius: 6,
            background: "hsl(var(--border))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>
            {take.linkedArticle.thumbnailEmoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginBottom: 2 }}>
              {take.linkedArticle.source} · {timeAgo(take.linkedArticle.publishedAt)}
            </p>
            <p style={{
              fontSize: 11, fontWeight: 500, color: "hsl(var(--foreground))",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {take.linkedArticle.headline}
            </p>
          </div>
          <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>›</span>
        </a>
      )}

      {/* Vote buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => handleVote("agree")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, padding: "5px 11px", borderRadius: 7,
            border: votes.userVote === "agree" ? "0.5px solid #16A34A" : "0.5px solid hsl(var(--border))",
            background: votes.userVote === "agree" ? "#EAF3DE" : "hsl(var(--secondary))",
            color: votes.userVote === "agree" ? "#16A34A" : "hsl(var(--muted-foreground))",
            fontWeight: votes.userVote === "agree" ? 500 : 400,
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          👍 Agree · {votes.agree.toLocaleString()}
        </button>
        <button
          onClick={() => handleVote("disagree")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, padding: "5px 11px", borderRadius: 7,
            border: votes.userVote === "disagree" ? "0.5px solid #DC2626" : "0.5px solid hsl(var(--border))",
            background: votes.userVote === "disagree" ? "#FEF2F2" : "hsl(var(--secondary))",
            color: votes.userVote === "disagree" ? "#DC2626" : "hsl(var(--muted-foreground))",
            fontWeight: votes.userVote === "disagree" ? 500 : 400,
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          👎 Disagree · {votes.disagree.toLocaleString()}
        </button>
        <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginLeft: "auto" }}>
          {timeAgo(take.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function HotTakesSection() {
  return (
    <section style={{ padding: "18px 20px", borderBottom: "0.5px solid hsl(var(--border))" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "#DC2626" }}>🔥</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>Community hot takes</span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", background: "hsl(var(--secondary))", padding: "2px 6px", borderRadius: 5 }}>
            Most reacted today
          </span>
        </div>
        <button style={{ fontSize: 11, color: "#534AB7", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap" }}>
          Post a take →
        </button>
      </div>

      {/* Takes list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MOCK_TAKES.map(take => (
          <TakeCard key={take.id} take={take} />
        ))}
      </div>
    </section>
  );
}
