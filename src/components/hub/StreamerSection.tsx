import { useState, useEffect } from "react";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useXP } from "@/contexts/XPContext";

export interface StreamerCard {
  userId: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  currentTier: number;
  isLive: boolean;
  streamTitle: string;
  viewerCount: number | null;
  streamUrl: string | null;
  scheduledStartTime: Date | null;
  platform: "twitch" | "youtube";
}

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCountdown(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Starting soon";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} UTC`;
  }
  return `Starts in ${hours > 0 ? `${hours}h ` : ""}${mins}m`;
}

function StreamerCardItem({ streamer }: { streamer: StreamerCard }) {
  const { addXP } = useXP();
  const [reminded, setReminded] = useState(false);

  const handleRemind = () => {
    setReminded(true);
    addXP(5);
  };

  return (
    <div
      style={{
        background: "var(--color-background-primary, hsl(var(--card)))",
        border: `0.5px solid ${streamer.isLive ? "rgba(220,38,38,0.3)" : "hsl(var(--border))"}`,
        borderRadius: 11,
        padding: "11px 13px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: streamer.avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 500, color: "#fff",
          }}
        >
          {streamer.avatarInitials}
        </div>
        {streamer.isLive && (
          <div
            style={{
              position: "absolute", inset: -2,
              borderRadius: "50%",
              border: "2px solid #DC2626",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 12, fontWeight: 500,
          color: streamer.isLive ? "#DC2626" : "var(--foreground)",
          marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {streamer.username}
        </p>
        <p style={{
          fontSize: 10, color: "hsl(var(--muted-foreground))",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4,
        }}>
          {streamer.streamTitle}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {streamer.isLive && (
            <>
              <span style={{
                background: "#DC2626", color: "#fff",
                fontSize: 8, fontWeight: 500, padding: "2px 5px", borderRadius: 4,
                display: "flex", alignItems: "center", gap: 3,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                LIVE
              </span>
              {streamer.viewerCount !== null && (
                <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>
                  {formatViewers(streamer.viewerCount)} watching
                </span>
              )}
            </>
          )}
          {!streamer.isLive && streamer.scheduledStartTime && (
            <span style={{
              fontSize: 9, color: "hsl(var(--muted-foreground))",
              background: "hsl(var(--secondary))", padding: "2px 6px", borderRadius: 5,
            }}>
              {formatCountdown(streamer.scheduledStartTime)}
            </span>
          )}
          <span style={{
            fontSize: 8, fontWeight: 500, color: "#3C3489",
            background: "#EEEDFE", padding: "1px 5px", borderRadius: 4, marginLeft: "auto",
          }}>
            Tier {streamer.currentTier}
          </span>
        </div>
      </div>

      {/* Action */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        {streamer.isLive && streamer.streamUrl && (
          <a
            href={streamer.streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 9, fontWeight: 500, color: "#fff",
              background: "#DC2626", border: "none",
              padding: "4px 9px", borderRadius: 5, textDecoration: "none", cursor: "pointer",
            }}
          >
            Watch →
          </a>
        )}
        {!streamer.isLive && (
          <button
            onClick={handleRemind}
            style={{
              fontSize: 9, color: reminded ? "#16A34A" : "#534AB7",
              background: reminded ? "#EAF3DE" : "#EEEDFE", border: "none",
              padding: "4px 9px", borderRadius: 5, cursor: "pointer",
            }}
          >
            {reminded ? "Reminder set ✓" : "Remind me"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_STREAMERS: StreamerCard[] = [
  {
    userId: "1", username: "@axelgaming", avatarInitials: "AX", avatarColor: "#534AB7", currentTier: 18,
    isLive: true, streamTitle: "Valorant · VCL Watch Party", viewerCount: 12400,
    streamUrl: "https://twitch.tv/valorant", scheduledStartTime: null, platform: "twitch",
  },
  {
    userId: "2", username: "@nova_fps", avatarInitials: "NF", avatarColor: "#0D9488", currentTier: 12,
    isLive: true, streamTitle: "CS2 Ranked Grind", viewerCount: 8250,
    streamUrl: "https://twitch.tv/novafps", scheduledStartTime: null, platform: "twitch",
  },
  {
    userId: "3", username: "@stormrift", avatarInitials: "SR", avatarColor: "#D97706", currentTier: 9,
    isLive: false, streamTitle: "Elden Ring Challenge Run",
    scheduledStartTime: new Date(Date.now() + 2.25 * 60 * 60 * 1000),
    viewerCount: null, streamUrl: null, platform: "twitch",
  },
  {
    userId: "4", username: "@lunagames", avatarInitials: "LG", avatarColor: "#DC2626", currentTier: 22,
    isLive: false, streamTitle: "GTA 6 Hype Stream",
    scheduledStartTime: new Date(Date.now() + 5.5 * 60 * 60 * 1000),
    viewerCount: null, streamUrl: null, platform: "youtube",
  },
];

export function StreamerSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const liveStreamers = MOCK_STREAMERS.filter(s => s.isLive);
  const upcoming = MOCK_STREAMERS.filter(s => !s.isLive);

  return (
    <section style={{ padding: "18px 20px", borderBottom: "0.5px solid hsl(var(--border))" }}>
      {/* Section Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" fill="#DC2626"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>Your streamers</span>
          {liveStreamers.length > 0 && (
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", background: "hsl(var(--secondary))", padding: "2px 6px", borderRadius: 5 }}>
              {liveStreamers.length} live now
            </span>
          )}
        </div>
        <button style={{ fontSize: 11, color: "#534AB7", cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap" }}>
          Discover streamers →
        </button>
      </div>

      {/* Guest empty state */}
      {!isAuthenticated && (
        <div style={{ background: "hsl(var(--secondary))", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 4 }}>
            You're not following any streamers yet.
          </p>
          <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
            Follow streamers to see their schedule here.
          </p>
          <button style={{
            fontSize: 11, fontWeight: 500, color: "#fff",
            background: "#534AB7", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer",
          }}>
            Discover streamers →
          </button>
        </div>
      )}

      {/* 2×2 Grid */}
      {isAuthenticated && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[...liveStreamers, ...upcoming].slice(0, 4).map(s => (
            <StreamerCardItem key={s.userId} streamer={s} />
          ))}
        </div>
      )}
    </section>
  );
}
