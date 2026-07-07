// src/lib/trending.ts
// Frontend formatting utilities for trending signals.
// The actual scores are computed server-side by the compute-trending edge function
// and stored in the trending_scores table.

export interface TrendingSignals {
  compositeScore: number;
  newsScore: number;
  steamScore: number;
  twitchScore: number;
  esportsScore: number;
  communityScore: number;
  rawgScore: number;
  releaseProximityScore: number;
}

/** Reverse the log10 transform used by the backend to get approximate player count. */
export function steamScoreToPlayers(score: number): number {
  return Math.max(0, Math.round(Math.pow(10, score) - 1));
}

/** Format a player count for display (e.g. "482K", "12.3K", "456"). */
export function formatPlayerCount(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

/** Format a "why trending" subtitle for display. */
export function getTrendingReason(signals: Partial<TrendingSignals>): string {
  const reasons: string[] = [];
  const steamPlayers = signals.steamScore ? steamScoreToPlayers(signals.steamScore) : 0;
  if (steamPlayers > 10_000) {
    reasons.push(`🔥 ${formatPlayerCount(steamPlayers)} playing on Steam`);
  }
  if (signals.newsScore && signals.newsScore > 0.5) {
    reasons.push("📰 In the news");
  }
  if (signals.releaseProximityScore && signals.releaseProximityScore > 20) {
    if (signals.releaseProximityScore >= 80) {
      reasons.push("🚀 Launching soon");
    } else {
      reasons.push("🚀 Coming soon");
    }
  }
  if (signals.twitchScore && signals.twitchScore > 10) {
    reasons.push("📺 Popular on Twitch");
  }
  if (signals.esportsScore && signals.esportsScore > 0) {
    reasons.push("🏆 Esports active");
  }
  if (reasons.length === 0 && signals.compositeScore && signals.compositeScore > 0) {
    reasons.push("⭐ Community buzz");
  }
  return reasons.join(" · ") || "Trending";
}
