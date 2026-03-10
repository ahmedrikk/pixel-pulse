import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Home, Star, Trophy, Swords, Lock, ExternalLink, ChevronRight } from "lucide-react";

// ─── TYPES ──────────────────────────────────────────────────
type TabId = "rewards" | "quests" | "howto";
type RewardType = "badge" | "title" | "coupon" | "frame" | "cosmetic" | "milestone" | "ultimate";

interface Tier {
  tier: number;
  xp: number;
  reward: string;
  type: RewardType;
  icon: string;
  act: number;
  unlocked: boolean;
}

interface Quest {
  id: string;
  icon: string;
  title: string;
  description: string;
  xpReward: number;
  current: number;
  target: number;
  done: boolean;
}

// ─── CONSTANTS ──────────────────────────────────────────────
const CURRENT_XP = 13750;
const CURRENT_TIER = 13;
const MAX_TIER = 25;
const XP_PER_TIER = 1000;
const SEASON_XP_MAX = 25000;
const TIER_XP_CURRENT = 750;
const TIER_XP_MAX = 1000;

const REWARD_COLORS: Record<RewardType, { bg: string; border: string; text: string; glow: string }> = {
  badge:     { bg: "#1a2a4a", border: "#3b82f6", text: "#93c5fd", glow: "rgba(59,130,246,0.3)" },
  title:     { bg: "#2a1a3a", border: "#8b5cf6", text: "#c4b5fd", glow: "rgba(139,92,246,0.3)" },
  coupon:    { bg: "#1a3a2a", border: "#10b981", text: "#6ee7b7", glow: "rgba(16,185,129,0.3)" },
  frame:     { bg: "#3a2a1a", border: "#f59e0b", text: "#fcd34d", glow: "rgba(245,158,11,0.3)" },
  cosmetic:  { bg: "#2a1a2a", border: "#ec4899", text: "#f9a8d4", glow: "rgba(236,72,153,0.3)" },
  milestone: { bg: "#3a2a0a", border: "#f59e0b", text: "#fbbf24", glow: "rgba(251,191,36,0.5)" },
  ultimate:  { bg: "#3a1a0a", border: "#ef4444", text: "#fca5a5", glow: "rgba(239,68,68,0.6)" },
};

const TIERS: Tier[] = [
  { tier: 1,  xp: 1000,  reward: "Newcomer Badge",             type: "badge",     icon: "🏅", act: 1, unlocked: true },
  { tier: 2,  xp: 2000,  reward: "Title: Press Start",         type: "title",     icon: "🏷️", act: 1, unlocked: true },
  { tier: 3,  xp: 3000,  reward: "5% Gaming Coupon",           type: "coupon",    icon: "🎟️", act: 1, unlocked: true },
  { tier: 4,  xp: 4000,  reward: "Bronze Leaderboard Frame",   type: "frame",     icon: "🖼️", act: 1, unlocked: true },
  { tier: 5,  xp: 5000,  reward: "10% Coupon + Level Grinder", type: "milestone", icon: "⭐", act: 1, unlocked: true },
  { tier: 6,  xp: 6000,  reward: "Silver Reaction Emotes",     type: "cosmetic",  icon: "✨", act: 2, unlocked: true },
  { tier: 7,  xp: 7000,  reward: "Title: Lore Keeper",         type: "title",     icon: "🏷️", act: 2, unlocked: true },
  { tier: 8,  xp: 8000,  reward: "10% Coupon (Partner B)",     type: "coupon",    icon: "🎟️", act: 2, unlocked: true },
  { tier: 9,  xp: 9000,  reward: "Silver Leaderboard Frame",   type: "frame",     icon: "🖼️", act: 2, unlocked: true },
  { tier: 10, xp: 10000, reward: "15% Coupon + Anim Badge",    type: "milestone", icon: "⭐", act: 2, unlocked: true },
  { tier: 11, xp: 11000, reward: "Title: Meta Analyst",        type: "title",     icon: "🏷️", act: 2, unlocked: true },
  { tier: 12, xp: 12000, reward: "Dark Mode UI Skin",          type: "cosmetic",  icon: "🎨", act: 2, unlocked: true },
  { tier: 13, xp: 13000, reward: "15% Coupon (Partner C)",     type: "coupon",    icon: "🎟️", act: 3, unlocked: true },
  { tier: 14, xp: 14000, reward: "Gold Leaderboard Frame",     type: "frame",     icon: "🖼️", act: 3, unlocked: false },
  { tier: 15, xp: 15000, reward: "20% Coupon + Final Boss",    type: "milestone", icon: "⭐", act: 3, unlocked: false },
  { tier: 16, xp: 16000, reward: "Trivia Champion Badge",      type: "badge",     icon: "🏅", act: 3, unlocked: false },
  { tier: 17, xp: 17000, reward: "Title: Esports Oracle",      type: "title",     icon: "🏷️", act: 3, unlocked: false },
  { tier: 18, xp: 18000, reward: "20% Coupon + Plat Frame",    type: "coupon",    icon: "🎟️", act: 4, unlocked: false },
  { tier: 19, xp: 19000, reward: "Animated Profile Border",    type: "cosmetic",  icon: "✨", act: 4, unlocked: false },
  { tier: 20, xp: 20000, reward: "25% Mega Coupon Bundle",     type: "milestone", icon: "⭐", act: 4, unlocked: false },
  { tier: 21, xp: 21000, reward: "Title: Elite Correspondent", type: "title",     icon: "🏷️", act: 4, unlocked: false },
  { tier: 22, xp: 22000, reward: "Rare Season Badge",          type: "badge",     icon: "🏅", act: 4, unlocked: false },
  { tier: 23, xp: 23000, reward: "30% Premium Coupon",         type: "coupon",    icon: "🎟️", act: 5, unlocked: false },
  { tier: 24, xp: 24000, reward: "Diamond Crown Frame",        type: "frame",     icon: "🖼️", act: 5, unlocked: false },
  { tier: 25, xp: 25000, reward: "SEASON CHAMPION + 40% Bundle", type: "ultimate", icon: "👑", act: 5, unlocked: false },
];

const ACTS = [
  { num: 1, name: "Origin",  color: "#f97316", range: [0, 5000] as [number, number], tiers: "T1–5" },
  { num: 2, name: "Rising",  color: "#3b82f6", range: [5000, 12000] as [number, number], tiers: "T6–12" },
  { num: 3, name: "Apex",    color: "#8b5cf6", range: [12000, 17000] as [number, number], tiers: "T13–17" },
  { num: 4, name: "Siege",   color: "#f59e0b", range: [17000, 22000] as [number, number], tiers: "T18–22" },
  { num: 5, name: "Endgame", color: "#ef4444", range: [22000, 25000] as [number, number], tiers: "T23–25" },
];

const INITIAL_QUESTS: Quest[] = [
  { id: "q1", icon: "📰", title: "Morning Dispatch",  description: "Read 3 article summaries",       xpReward: 60, current: 3, target: 3, done: true },
  { id: "q2", icon: "🔗", title: "Deep Dive",         description: "Click 'Read More' on 2 articles", xpReward: 70, current: 2, target: 2, done: true },
  { id: "q3", icon: "🧠", title: "Brain Check",       description: "Complete the daily trivia quiz",   xpReward: 80, current: 1, target: 1, done: true },
  { id: "q4", icon: "💬", title: "Community Voice",    description: "Leave a comment on any article",   xpReward: 25, current: 0, target: 1, done: false },
  { id: "q5", icon: "🏆", title: "Call It",            description: "Submit an esports prediction",     xpReward: 25, current: 0, target: 1, done: false },
  { id: "q6", icon: "❤️", title: "Reaction Pulse",     description: "React to 3 different articles",    xpReward: 30, current: 1, target: 3, done: false },
  { id: "q7", icon: "🔥", title: "Streak Keeper",      description: "Maintain your daily login streak", xpReward: 50, current: 1, target: 1, done: true },
];

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
];

const XP_SOURCES = [
  {
    group: "CORE", color: "#f97316", num: "①",
    actions: [
      { icon: "📰", name: "Read Article Summary", xp: 20, limit: "10×/day" },
      { icon: "🔗", name: "Click 'Read Full Article'", xp: 35, limit: "8×/day" },
      { icon: "🔥", name: "Article Combo (4+ reads)", xp: 40, limit: "1×/day" },
    ],
  },
  {
    group: "LOYALTY", color: "#3b82f6", num: "②",
    actions: [
      { icon: "📅", name: "Daily Login", xp: 50, limit: "1×/day" },
      { icon: "⚡", name: "7-Day Streak Bonus", xp: 200, limit: "1×/week" },
      { icon: "💎", name: "30-Day Streak Bonus", xp: 600, limit: "1×/month" },
    ],
  },
  {
    group: "TRIVIA", color: "#10b981", num: "③",
    actions: [
      { icon: "🧠", name: "Daily Trivia Quiz", xp: 30, limit: "1×/day" },
      { icon: "✅", name: "Trivia Correct Answer", xp: 15, limit: "5×/day" },
      { icon: "🎯", name: "Perfect Trivia Score", xp: 50, limit: "1×/day" },
    ],
  },
  {
    group: "ESPORTS", color: "#f59e0b", num: "④",
    actions: [
      { icon: "🏆", name: "Esports Prediction", xp: 25, limit: "3×/day" },
      { icon: "🎮", name: "Correct Prediction Bonus", xp: 60, limit: "3×/day" },
    ],
  },
  {
    group: "SOCIAL", color: "#8b5cf6", num: "⑤",
    actions: [
      { icon: "💬", name: "Comment on Article", xp: 25, limit: "5×/day" },
      { icon: "❤️", name: "React to Article", xp: 10, limit: "Per article" },
      { icon: "⭐", name: "Submit Game Review", xp: 75, limit: "Per game" },
    ],
  },
  {
    group: "PASSIVE", color: "#64748b", num: "⑥",
    actions: [
      { icon: "📜", name: "Page Scroll (90%)", xp: 8, limit: "5×/day" },
    ],
  },
];

const STREAK_MULTIPLIERS = [
  { range: "Day 1–2", mult: "1.0×", color: "#374151" },
  { range: "Day 3–6", mult: "1.2×", color: "#64748b" },
  { range: "Day 7–13", mult: "1.5×", color: "#f97316" },
  { range: "Day 14–29", mult: "1.75×", color: "#f59e0b" },
  { range: "Day 30+", mult: "2.0×", color: "#ef4444" },
];

// ─── HELPERS ─────────────────────────────────────────────────
function useCountdown(targetDate: Date) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, targetDate.getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, formatted: `${String(d).padStart(2, "0")}:${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

function useQuestResetCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.32 },
};

// ─── SHIMMER BAR ────────────────────────────────────────────
function ShimmerBar({ percent, delay = 0, color = "#f97316", height = "h-3", className = "" }: { percent: number; delay?: number; color?: string; height?: string; className?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(percent), delay);
    return () => clearTimeout(t);
  }, [percent, delay]);

  return (
    <div className={`relative w-full ${height} rounded-full overflow-hidden ${className}`} style={{ background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full relative"
        style={{
          width: `${w}%`,
          background: `linear-gradient(90deg, ${color}, ${color}dd, ${color})`,
          boxShadow: `0 0 16px ${color}66`,
          transition: `width 1.2s cubic-bezier(0.22,1,0.36,1)`,
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)`,
            animation: "shimmer 2s infinite",
          }}
        />
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
export default function BattlePass() {
  const [activeTab, setActiveTab] = useState<TabId>("rewards");
  const [selectedTier, setSelectedTier] = useState(14);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const trackRef = useRef<HTMLDivElement>(null);
  const seasonEnd = useMemo(() => new Date(Date.now() + 63 * 86400000), []);
  const countdown = useCountdown(seasonEnd);
  const questReset = useQuestResetCountdown();

  const doneCount = quests.filter((q) => q.done).length;
  const earnedXP = quests.filter((q) => q.done).reduce((s, q) => s + q.xpReward, 0);
  const allDone = doneCount === 7;

  // Auto-scroll track to current tier
  useEffect(() => {
    if (activeTab === "rewards" && trackRef.current) {
      const t = setTimeout(() => {
        const el = trackRef.current?.querySelector(`[data-tier="${CURRENT_TIER}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [activeTab]);

  const completeQuest = useCallback((id: string) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === id ? { ...q, done: true, current: q.target } : q))
    );
  }, []);

  const selected = TIERS[selectedTier - 1];
  const selectedColors = REWARD_COLORS[selected.type];
  const xpAway = Math.max(0, selected.xp - CURRENT_XP);
  const tierProgress = selected.unlocked ? 100 : Math.min(100, (CURRENT_XP / selected.xp) * 100);

  const sidebarTabs: { id: TabId; label: string; icon: string }[] = [
    { id: "rewards", label: "Season & Rewards", icon: "◈" },
    { id: "quests",  label: "Daily Quests",     icon: "◉" },
    { id: "howto",   label: "How to Earn XP",   icon: "◇" },
  ];

  return (
    <div className="min-h-screen font-['Barlow',sans-serif]" style={{ background: "#070d18" }}>
      {/* Atmospheric overlays */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full" style={{ background: "radial-gradient(ellipse, rgba(249,115,22,0.06), transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full" style={{ background: "radial-gradient(ellipse, rgba(59,130,246,0.04), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(249,115,22,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.022) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 h-[52px] flex items-center justify-between px-5 border-b" style={{ background: "rgba(7,13,24,0.85)", backdropFilter: "blur(12px)", borderColor: "#f9731633" }}>
        <div className="flex items-center gap-3">
          <span className="font-['Barlow_Condensed',sans-serif] font-bold text-lg tracking-wide" style={{ color: "#f97316" }}>GAME PULSE</span>
          <span className="w-px h-5" style={{ background: "#ffffff20" }} />
          <span className="font-['Rajdhani',sans-serif] font-600 text-sm tracking-wider" style={{ color: "#ffffff60" }}>BATTLE PASS</span>
          <span className="font-['Rajdhani',sans-serif] font-700 text-sm" style={{ color: "#f97316" }}>S1</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="font-['Rajdhani',sans-serif] text-xs tracking-wider" style={{ color: "#ffffff50" }}>ENDS</span>
            <span className="font-['Barlow_Condensed',sans-serif] font-bold text-base tracking-wide" style={{ color: "#ffffffcc" }}>{countdown.formatted}</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-['Rajdhani',sans-serif] font-bold tracking-wider"
            style={{ background: "#f9731620", border: "1px solid #f9731640", color: "#f97316", boxShadow: "0 0 12px rgba(249,115,22,0.3)", animation: "glowPulse 2s ease-in-out infinite" }}
          >
            TIER {CURRENT_TIER} / {MAX_TIER}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside className="w-[205px] min-h-[calc(100vh-52px)] sticky top-[52px] flex flex-col border-r px-0 py-0 shrink-0" style={{ background: "#070d18", borderColor: "#ffffff0d" }}>
          {/* Season info */}
          <div className="px-4 pt-5 pb-3">
            <p className="font-['Rajdhani',sans-serif] font-600 text-[10px] tracking-[0.2em] uppercase" style={{ color: "#ffffff40" }}>SEASON 1</p>
            <h3 className="font-['Barlow_Condensed',sans-serif] font-800 text-base tracking-wide mt-0.5" style={{ color: "#ffffffdd" }}>SEASON OF THE EMBER</h3>
            <p className="font-['Rajdhani',sans-serif] font-600 text-[10px] tracking-wider mt-0.5" style={{ color: "#f97316" }}>S1</p>
          </div>

          {/* XP bar */}
          <div className="px-4 pb-4">
            <ShimmerBar percent={(CURRENT_XP / SEASON_XP_MAX) * 100} delay={600} height="h-2" />
            <div className="flex justify-between mt-1">
              <span className="font-['Barlow_Condensed',sans-serif] text-[11px] font-600" style={{ color: "#f97316" }}>13,750</span>
              <span className="font-['Barlow_Condensed',sans-serif] text-[11px] font-600" style={{ color: "#ffffff40" }}>25,000 XP</span>
            </div>
          </div>

          <div className="w-full h-px" style={{ background: "#ffffff0d" }} />

          {/* Nav tabs */}
          <div className="py-2">
            {sidebarTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all duration-200"
                style={{
                  borderLeft: activeTab === t.id ? "3px solid #f97316" : "3px solid transparent",
                  background: activeTab === t.id ? "#f9731610" : "transparent",
                  color: activeTab === t.id ? "#f97316" : "#ffffff70",
                }}
              >
                <span className="text-sm">{t.icon}</span>
                <span className="font-['Rajdhani',sans-serif] font-600 text-[13px] tracking-wide">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="w-full h-px" style={{ background: "#ffffff0d" }} />

          {/* Quest strip */}
          <div className="px-4 py-4 mt-auto">
            <div className="flex gap-1 mb-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-[6px] rounded-full"
                  style={{ background: i < doneCount ? "#10b981" : "#ffffff10" }}
                />
              ))}
            </div>
            <p className="font-['Barlow',sans-serif] text-[11px]" style={{ color: "#ffffff50" }}>
              {doneCount}/7 · <span style={{ color: "#10b981" }}>+{earnedXP} XP</span>
            </p>
          </div>

          {/* Site nav links */}
          <div className="border-t px-2 py-3" style={{ borderColor: "#ffffff0d" }}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded transition-colors"
                style={{ color: item.href === "/battle-pass" ? "#f97316" : "#ffffff50" }}
              >
                <item.icon className="h-4 w-4" />
                <span className="font-['Rajdhani',sans-serif] text-[12px] font-600 tracking-wide">{item.label}</span>
              </Link>
            ))}
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-h-[calc(100vh-52px)] overflow-x-hidden bp-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === "rewards" && (
              <motion.div key="rewards" {...fadeUp} className="p-6 space-y-8">
                <RewardsTab
                  selectedTier={selectedTier}
                  setSelectedTier={setSelectedTier}
                  trackRef={trackRef}
                  selected={selected}
                  selectedColors={selectedColors}
                  xpAway={xpAway}
                  tierProgress={tierProgress}
                />
              </motion.div>
            )}
            {activeTab === "quests" && (
              <motion.div key="quests" {...fadeUp} className="p-6 space-y-6">
                <QuestsTab
                  quests={quests}
                  completeQuest={completeQuest}
                  questReset={questReset}
                  doneCount={doneCount}
                  earnedXP={earnedXP}
                  allDone={allDone}
                />
              </motion.div>
            )}
            {activeTab === "howto" && (
              <motion.div key="howto" {...fadeUp} className="p-6 space-y-8">
                <HowToTab />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@300;400;500&family=Rajdhani:wght@500;600;700&display=swap');

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(249,115,22,0.3); }
          50% { box-shadow: 0 0 24px rgba(249,115,22,0.5); }
        }
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 20px rgba(239,68,68,0.7); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .bp-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
        .bp-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .bp-scrollbar::-webkit-scrollbar-thumb { background: #f9731640; border-radius: 3px; }
        .bp-scrollbar *::-webkit-scrollbar { width: 3px; height: 3px; }
        .bp-scrollbar *::-webkit-scrollbar-track { background: transparent; }
        .bp-scrollbar *::-webkit-scrollbar-thumb { background: #f9731640; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─── TAB 1: REWARDS ─────────────────────────────────────────
function RewardsTab({
  selectedTier, setSelectedTier, trackRef, selected, selectedColors, xpAway, tierProgress,
}: {
  selectedTier: number;
  setSelectedTier: (t: number) => void;
  trackRef: React.RefObject<HTMLDivElement>;
  selected: Tier;
  selectedColors: { bg: string; border: string; text: string; glow: string };
  xpAway: number;
  tierProgress: number;
}) {
  const actName = ACTS.find((a) => a.num === selected.act);

  return (
    <>
      {/* Section A - Title */}
      <div>
        <p className="font-['Rajdhani',sans-serif] text-[11px] font-600 tracking-[0.2em] uppercase" style={{ color: "#f97316" }}>
          ◈ SEASON PROGRESS · REWARD TRACK
        </p>
        <div className="flex items-end justify-between mt-1">
          <h1 className="font-['Barlow_Condensed',sans-serif] font-800 text-3xl tracking-wide" style={{ color: "#ffffffee" }}>
            SEASON OF THE EMBER
          </h1>
          <span className="font-['Rajdhani',sans-serif] text-sm font-600 tracking-wider" style={{ color: "#ffffff40" }}>
            FREE BATTLE PASS · <span style={{ color: "#f97316" }}>S1</span>
          </span>
        </div>
      </div>

      {/* Section B - Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "CURRENT TIER", value: CURRENT_TIER, sub: `of ${MAX_TIER}`, color: "#f97316" },
          { label: "SEASON XP", value: "13,750", sub: "earned", color: "#3b82f6" },
          { label: "XP TO NEXT", value: "250", sub: "tier 14", color: "#f59e0b" },
          { label: "COMPLETION", value: "55%", sub: "season done", color: "#10b981" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-lg p-4"
            style={{ background: "#ffffff06", borderTop: `3px solid ${c.color}` }}
          >
            <p className="font-['Rajdhani',sans-serif] text-[10px] font-600 tracking-[0.15em]" style={{ color: "#ffffff40" }}>{c.label}</p>
            <p className="font-['Barlow_Condensed',sans-serif] font-800 text-2xl mt-1" style={{ color: c.color }}>{c.value}</p>
            <p className="font-['Barlow',sans-serif] text-[11px] font-300" style={{ color: "#ffffff40" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Section C - Tier Progress Bar */}
      <div className="rounded-lg p-4" style={{ background: "#ffffff06" }}>
        <div className="flex justify-between items-center mb-2">
          <span className="font-['Rajdhani',sans-serif] text-xs font-600 tracking-wider" style={{ color: "#ffffffaa" }}>
            TIER {CURRENT_TIER} → TIER {CURRENT_TIER + 1}
          </span>
          <span className="font-['Barlow_Condensed',sans-serif] text-xs font-600" style={{ color: "#f59e0b" }}>
            250 XP remaining
          </span>
        </div>
        <ShimmerBar percent={(TIER_XP_CURRENT / TIER_XP_MAX) * 100} delay={400} />
        <div className="flex justify-between mt-1.5">
          {[0, 250, 500, 750, 1000].map((v) => (
            <span key={v} className="font-['Barlow',sans-serif] text-[10px]" style={{ color: "#ffffff30" }}>{v}</span>
          ))}
        </div>
      </div>

      {/* Section D - Season Completion / Act Segments */}
      <div className="rounded-lg p-4" style={{ background: "#ffffff06" }}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-['Rajdhani',sans-serif] text-xs font-600 tracking-wider" style={{ color: "#ffffffaa" }}>SEASON COMPLETION</span>
          <span className="font-['Barlow_Condensed',sans-serif] text-xs font-600" style={{ color: "#3b82f6" }}>13,750 / 25,000 XP</span>
        </div>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          {ACTS.map((act) => {
            const actWidth = ((act.range[1] - act.range[0]) / SEASON_XP_MAX) * 100;
            const filled = Math.min(1, Math.max(0, (CURRENT_XP - act.range[0]) / (act.range[1] - act.range[0])));
            return (
              <div key={act.num} className="relative h-full" style={{ width: `${actWidth}%` }}>
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${filled * 100}%`,
                    background: act.color,
                    transition: "width 1s ease",
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          {ACTS.map((act) => {
            const done = CURRENT_XP >= act.range[1];
            return (
              <span key={act.num} className="font-['Rajdhani',sans-serif] text-[10px] font-600 tracking-wider" style={{ color: done ? act.color : "#ffffff30" }}>
                {done && "✓ "}ACT {act.num} · {act.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Section E - Reward Track */}
      <div>
        <p className="font-['Rajdhani',sans-serif] text-[11px] font-600 tracking-[0.2em] mb-3" style={{ color: "#f97316" }}>
          ◆ REWARD TRACK — ALL 25 TIERS
        </p>
        {/* Act legend */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {ACTS.map((act) => (
            <div key={act.num} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: "#ffffff08" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: act.color }} />
              <span className="font-['Rajdhani',sans-serif] text-[10px] font-600 tracking-wider" style={{ color: "#ffffff60" }}>
                ACT {act.num} · {act.name} ({act.tiers})
              </span>
            </div>
          ))}
        </div>

        {/* Horizontal track */}
        <div ref={trackRef as any} className="overflow-x-auto pb-4 bp-scrollbar">
          <div className="flex gap-2 min-w-max px-1 py-2">
            {TIERS.map((t) => {
              const colors = REWARD_COLORS[t.type];
              const isCurrent = t.tier === CURRENT_TIER;
              const isNext = t.tier === CURRENT_TIER + 1;
              const isSelected = t.tier === selectedTier;
              const isMilestone = [5, 10, 15, 20, 25].includes(t.tier);
              const isUltimate = t.tier === 25;

              return (
                <div key={t.tier} data-tier={t.tier} className="flex flex-col items-center gap-1">
                  {/* Badge above */}
                  {isCurrent && (
                    <span className="font-['Rajdhani',sans-serif] text-[9px] font-700 tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#f9731630", color: "#f97316" }}>
                      ▶ NOW
                    </span>
                  )}
                  {isNext && !isCurrent && (
                    <span className="font-['Rajdhani',sans-serif] text-[9px] font-700 tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#ffffff10", color: "#ffffff50" }}>
                      NEXT
                    </span>
                  )}
                  {!isCurrent && !isNext && <div className="h-[22px]" />}

                  {/* Tier label */}
                  <span className="font-['Rajdhani',sans-serif] text-[9px] font-600 tracking-wider" style={{ color: "#ffffff30" }}>
                    T·{t.tier}
                  </span>

                  {/* Card */}
                  <button
                    onClick={() => setSelectedTier(t.tier)}
                    className="relative w-[76px] h-[88px] rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer"
                    style={{
                      background: t.unlocked ? colors.bg : "#0a0f1a",
                      border: `2px solid ${isCurrent ? "#f97316" : isSelected ? colors.border : t.unlocked ? colors.border + "80" : "#ffffff12"}`,
                      opacity: t.unlocked ? 1 : 0.38,
                      boxShadow: isCurrent
                        ? "0 0 20px rgba(249,115,22,0.5)"
                        : isUltimate
                        ? undefined
                        : isMilestone && t.unlocked
                        ? `0 0 12px ${REWARD_COLORS.milestone.glow}`
                        : isSelected
                        ? `0 0 12px ${colors.glow}`
                        : "none",
                      animation: isUltimate ? "pulse-red 2s ease-in-out infinite" : undefined,
                      transform: isSelected ? "translateY(-5px) scale(1.05)" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = "translateY(-5px) scale(1.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = "none";
                      }
                    }}
                  >
                    {!t.unlocked && (
                      <Lock className="absolute top-1.5 right-1.5 w-3 h-3" style={{ color: "#ffffff20" }} />
                    )}
                    <span className="text-2xl">{t.icon}</span>
                    <span className="font-['Barlow',sans-serif] text-[9px]" style={{ color: t.unlocked ? colors.text : "#ffffff30" }}>
                      {(t.xp / 1000).toFixed(0)}K XP
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          {/* Progress line */}
          <div className="mt-2 mx-1 h-1 rounded-full overflow-hidden" style={{ background: "#ffffff08" }}>
            <div className="h-full rounded-full" style={{ width: `${(CURRENT_XP / SEASON_XP_MAX) * 100}%`, background: "#f97316", transition: "width 1s ease" }} />
          </div>
        </div>
      </div>

      {/* Section F - Selected Tier Detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTier}
          {...fadeUp}
          className="rounded-xl p-5 flex gap-6"
          style={{
            background: selectedColors.bg,
            border: `1px solid ${selectedColors.border}40`,
            boxShadow: `0 0 30px ${selectedColors.glow}`,
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-['Barlow_Condensed',sans-serif] font-800 text-lg" style={{ color: selectedColors.border }}>
                TIER {selected.tier}
              </span>
              <span className="font-['Rajdhani',sans-serif] text-[10px] font-600 px-2 py-0.5 rounded tracking-wider" style={{ background: "#ffffff10", color: "#ffffff50" }}>
                ACT {selected.act} · {actName?.name}
              </span>
              <span className="font-['Rajdhani',sans-serif] text-[10px] font-600 px-2 py-0.5 rounded tracking-wider uppercase" style={{ background: selectedColors.border + "20", color: selectedColors.text }}>
                {selected.type}
              </span>
            </div>
            <div className="text-4xl mb-2">{selected.icon}</div>
            <p className="font-['Barlow_Condensed',sans-serif] font-700 text-base" style={{ color: "#ffffffcc" }}>{selected.reward}</p>
            <div className="mt-3 max-w-[280px]">
              <ShimmerBar percent={tierProgress} delay={200} color={selectedColors.border} height="h-2" />
              <p className="font-['Barlow',sans-serif] text-[10px] mt-1" style={{ color: "#ffffff40" }}>
                {tierProgress.toFixed(0)}% progress
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end justify-center">
            <p className="font-['Barlow_Condensed',sans-serif] font-800 text-3xl" style={{ color: selectedColors.border }}>
              {selected.xp.toLocaleString()} XP
            </p>
            {selected.unlocked ? (
              <span className="font-['Rajdhani',sans-serif] text-xs font-700 tracking-wider px-3 py-1 rounded-full mt-2" style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }}>
                ✓ UNLOCKED
              </span>
            ) : (
              <div className="text-right mt-1">
                <p className="font-['Barlow',sans-serif] text-sm" style={{ color: "#ffffff60" }}>{xpAway.toLocaleString()} XP away</p>
                <p className="font-['Barlow',sans-serif] text-[11px]" style={{ color: "#ffffff30" }}>
                  ≈ {Math.ceil(xpAway / 200)} days at avg pace
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Section G - Next Unlocks */}
      <div>
        <p className="font-['Rajdhani',sans-serif] text-[11px] font-600 tracking-[0.2em] mb-3" style={{ color: "#ffffff50" }}>
          NEXT UNLOCKS
        </p>
        <div className="grid grid-cols-3 gap-3">
          {TIERS.filter((t) => !t.unlocked).slice(0, 3).map((t) => {
            const colors = REWARD_COLORS[t.type];
            const prog = Math.min(100, (CURRENT_XP / t.xp) * 100);
            return (
              <button
                key={t.tier}
                onClick={() => setSelectedTier(t.tier)}
                className="rounded-lg p-4 text-left transition-all duration-200 cursor-pointer"
                style={{ background: "#ffffff06", border: `1px solid ${colors.border}30` }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{t.icon}</span>
                  <span className="font-['Rajdhani',sans-serif] text-[10px] font-600 px-1.5 py-0.5 rounded" style={{ background: colors.border + "20", color: colors.text }}>
                    T{t.tier}
                  </span>
                </div>
                <p className="font-['Barlow_Condensed',sans-serif] font-700 text-sm" style={{ color: "#ffffffcc" }}>{t.reward}</p>
                <p className="font-['Barlow',sans-serif] text-[10px] mt-1" style={{ color: "#ffffff40" }}>{(t.xp - CURRENT_XP).toLocaleString()} XP needed</p>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#ffffff08" }}>
                  <div className="h-full rounded-full" style={{ width: `${prog}%`, background: colors.border, transition: "width 0.8s ease" }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── TAB 2: QUESTS ──────────────────────────────────────────
function QuestsTab({
  quests, completeQuest, questReset, doneCount, earnedXP, allDone,
}: {
  quests: Quest[];
  completeQuest: (id: string) => void;
  questReset: string;
  doneCount: number;
  earnedXP: number;
  allDone: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div>
        <p className="font-['Rajdhani',sans-serif] text-[11px] font-600 tracking-[0.2em]" style={{ color: "#f97316" }}>
          ◉ DAILY QUESTS
        </p>
        <div className="flex items-end justify-between mt-1">
          <h1 className="font-['Barlow_Condensed',sans-serif] font-800 text-3xl tracking-wide" style={{ color: "#ffffffee" }}>
            TODAY'S CHALLENGES
          </h1>
          <div className="flex items-center gap-2">
            <span className="font-['Rajdhani',sans-serif] text-[11px] tracking-wider" style={{ color: "#ffffff40" }}>RESETS IN</span>
            <span className="font-['Barlow_Condensed',sans-serif] font-700 text-base" style={{ color: "#f97316" }}>{questReset}</span>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center justify-between rounded-lg p-4" style={{ background: "#ffffff06" }}>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-8 h-[6px] rounded-full" style={{ background: i < doneCount ? "#10b981" : "#ffffff10" }} />
            ))}
          </div>
          <span className="font-['Rajdhani',sans-serif] text-sm font-600" style={{ color: "#ffffff60" }}>
            {doneCount} of 7 complete
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-['Barlow_Condensed',sans-serif] font-700 text-xl" style={{ color: "#10b981" }}>+{earnedXP} XP</span>
          <span className="font-['Rajdhani',sans-serif] text-xs" style={{ color: "#ffffff40" }}>EARNED</span>
        </div>
      </div>

      {allDone && (
        <div className="flex justify-center">
          <span
            className="font-['Rajdhani',sans-serif] font-700 text-sm tracking-wider px-4 py-2 rounded-full"
            style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", animation: "float 2s ease-in-out infinite" }}
          >
            ✓ ALL DONE
          </span>
        </div>
      )}

      {/* Quest list */}
      <div className="space-y-2">
        {quests.map((q) => (
          <div
            key={q.id}
            className="flex items-center gap-4 rounded-lg transition-all duration-200"
            style={{
              background: "#ffffff06",
              padding: "13px",
              opacity: q.done ? 0.7 : 1,
              borderLeft: q.done ? "3px solid #10b981" : "3px solid transparent",
            }}
          >
            <span className="text-xl w-8 text-center">{q.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-['Barlow_Condensed',sans-serif] font-700 text-sm" style={{ color: q.done ? "#10b981" : "#ffffffcc" }}>
                  {q.title}
                </span>
                {q.done && (
                  <span className="font-['Rajdhani',sans-serif] text-[9px] font-700 tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#10b98120", color: "#10b981" }}>
                    DONE
                  </span>
                )}
              </div>
              <p className="font-['Barlow',sans-serif] text-[11px]" style={{ color: "#ffffff40" }}>{q.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "#ffffff08" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(q.current / q.target) * 100}%`, background: q.done ? "#10b981" : "#f97316" }} />
                </div>
                <span className="font-['Barlow',sans-serif] text-[10px]" style={{ color: "#ffffff30" }}>
                  {q.current}/{q.target}
                </span>
              </div>
            </div>
            <span className="font-['Barlow_Condensed',sans-serif] font-700 text-sm min-w-[50px] text-right" style={{ color: q.done ? "#10b981" : "#f97316" }}>
              {q.xpReward} XP
            </span>
            {!q.done && (
              <button
                onClick={() => completeQuest(q.id)}
                className="font-['Rajdhani',sans-serif] text-[11px] font-700 tracking-wider px-3 py-1.5 rounded transition-all duration-200"
                style={{ border: "1px solid #f9731640", color: "#f97316", background: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f9731615"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                GO →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pro tip */}
      <div className="rounded-lg p-4 flex items-start gap-3" style={{ background: "#f9731608", borderLeft: "3px solid #f97316" }}>
        <span className="text-lg">💡</span>
        <div>
          <p className="font-['Rajdhani',sans-serif] text-xs font-700 tracking-wider" style={{ color: "#f97316" }}>PRO TIP</p>
          <p className="font-['Barlow',sans-serif] text-sm mt-0.5" style={{ color: "#ffffff60" }}>
            Complete all 7 quests for a +50 XP All-Complete Bonus. Resets midnight UTC.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── TAB 3: HOW TO EARN XP ──────────────────────────────────
function HowToTab() {
  return (
    <>
      <div>
        <p className="font-['Rajdhani',sans-serif] text-[11px] font-600 tracking-[0.2em]" style={{ color: "#f97316" }}>
          ◇ HOW TO EARN XP
        </p>
        <h1 className="font-['Barlow_Condensed',sans-serif] font-800 text-3xl tracking-wide mt-1" style={{ color: "#ffffffee" }}>
          XP SOURCES
        </h1>
        <p className="font-['Rajdhani',sans-serif] text-xs font-600 tracking-wider mt-1" style={{ color: "#ffffff40" }}>
          DAILY CAP: <span style={{ color: "#f97316" }}>400 XP</span> · STREAK BONUSES EXEMPT FROM CAP
        </p>
      </div>

      {XP_SOURCES.map((group) => (
        <div key={group.group}>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-['Rajdhani',sans-serif] text-[11px] font-700 tracking-[0.15em] px-2 py-0.5 rounded" style={{ background: group.color + "20", color: group.color }}>
              {group.num} {group.group}
            </span>
            <div className="flex-1 h-px" style={{ background: group.color + "30" }} />
          </div>
          <div className="space-y-1.5 mb-6">
            {group.actions.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-3 rounded-lg px-4 py-2.5"
                style={{ background: "#ffffff04", borderLeft: `3px solid ${group.color}` }}
              >
                <span className="text-base w-6 text-center">{a.icon}</span>
                <div className="flex-1">
                  <span className="font-['Barlow_Condensed',sans-serif] font-600 text-sm" style={{ color: "#ffffffcc" }}>{a.name}</span>
                  <p className="font-['Barlow',sans-serif] text-[10px]" style={{ color: "#ffffff30" }}>Limit: {a.limit}</p>
                </div>
                <span className="font-['Barlow_Condensed',sans-serif] font-700 text-sm" style={{ color: group.color }}>
                  {a.xp > 0 ? "+" : ""}{a.xp} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Streak Multipliers */}
      <div className="rounded-xl p-5" style={{ background: "#3b82f608", border: "1px solid #3b82f620" }}>
        <p className="font-['Rajdhani',sans-serif] text-sm font-700 tracking-wider mb-4" style={{ color: "#3b82f6" }}>
          ⚡ STREAK MULTIPLIERS <span className="font-400 text-xs" style={{ color: "#ffffff40" }}>— article reading XP only</span>
        </p>
        <div className="grid grid-cols-5 gap-2">
          {STREAK_MULTIPLIERS.map((s) => (
            <div key={s.range} className="rounded-lg p-3 text-center" style={{ background: "#ffffff06", borderTop: `3px solid ${s.color}` }}>
              <p className="font-['Barlow_Condensed',sans-serif] font-800 text-xl" style={{ color: s.color }}>{s.mult}</p>
              <p className="font-['Rajdhani',sans-serif] text-[10px] font-600 tracking-wider mt-1" style={{ color: "#ffffff40" }}>{s.range}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
