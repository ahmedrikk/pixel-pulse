import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Home, Lock, Trophy, Zap, Star, Gift, Shield, Crown,
  ChevronRight, ChevronLeft, Clock, Flame, Award, Sparkles, Target,
} from "lucide-react";
import { useXP } from "@/contexts/XPContext";
import { Navbar } from "@/components/Navbar";
import { BottomNavBar } from "@/components/BottomNavBar";

// ─── TYPES ──────────────────────────────────────────────────
type RewardType = "badge" | "title" | "coupon" | "frame" | "cosmetic" | "milestone" | "ultimate";
type RewardTrack = "free" | "premium";

interface Tier {
  tier: number;
  xp: number;
  reward: string;
  type: RewardType;
  icon: string;
  act: number;
  unlocked: boolean;
  track: RewardTrack;
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

const TYPE_THEMES: Record<RewardType, { bg: string; border: string; text: string; icon: string }> = {
  badge:     { bg: "hsl(217 91% 96%)", border: "hsl(217 91% 60%)", text: "hsl(217 91% 40%)", icon: "🏅" },
  title:     { bg: "hsl(263 70% 96%)", border: "hsl(263 70% 55%)", text: "hsl(263 70% 35%)", icon: "🏷️" },
  coupon:    { bg: "hsl(160 84% 95%)", border: "hsl(160 84% 39%)", text: "hsl(160 84% 25%)", icon: "🎟️" },
  frame:     { bg: "hsl(38 92% 95%)",  border: "hsl(38 92% 50%)",  text: "hsl(38 92% 30%)",  icon: "🖼️" },
  cosmetic:  { bg: "hsl(330 81% 96%)", border: "hsl(330 81% 55%)", text: "hsl(330 81% 35%)", icon: "✨" },
  milestone: { bg: "hsl(38 92% 94%)",  border: "hsl(38 92% 50%)",  text: "hsl(38 92% 30%)",  icon: "⭐" },
  ultimate:  { bg: "hsl(0 84% 96%)",   border: "hsl(0 84% 55%)",   text: "hsl(0 84% 35%)",   icon: "👑" },
};

const FREE_TIERS: Tier[] = [
  { tier: 1,  xp: 1000,  reward: "Newcomer Badge",             type: "badge",     icon: "🏅", act: 1, unlocked: true,  track: "free" },
  { tier: 2,  xp: 2000,  reward: "Title: Press Start",         type: "title",     icon: "🏷️", act: 1, unlocked: true,  track: "free" },
  { tier: 3,  xp: 3000,  reward: "5% Gaming Coupon",           type: "coupon",    icon: "🎟️", act: 1, unlocked: true,  track: "free" },
  { tier: 4,  xp: 4000,  reward: "Bronze Leaderboard Frame",   type: "frame",     icon: "🖼️", act: 1, unlocked: true,  track: "free" },
  { tier: 5,  xp: 5000,  reward: "10% Coupon + Level Grinder", type: "milestone", icon: "⭐", act: 1, unlocked: true,  track: "free" },
  { tier: 6,  xp: 6000,  reward: "Silver Reaction Emotes",     type: "cosmetic",  icon: "✨", act: 2, unlocked: true,  track: "free" },
  { tier: 7,  xp: 7000,  reward: "Title: Lore Keeper",         type: "title",     icon: "🏷️", act: 2, unlocked: true,  track: "free" },
  { tier: 8,  xp: 8000,  reward: "10% Coupon (Partner B)",     type: "coupon",    icon: "🎟️", act: 2, unlocked: true,  track: "free" },
  { tier: 9,  xp: 9000,  reward: "Silver Leaderboard Frame",   type: "frame",     icon: "🖼️", act: 2, unlocked: true,  track: "free" },
  { tier: 10, xp: 10000, reward: "15% Coupon + Anim Badge",    type: "milestone", icon: "⭐", act: 2, unlocked: true,  track: "free" },
  { tier: 11, xp: 11000, reward: "Title: Meta Analyst",        type: "title",     icon: "🏷️", act: 2, unlocked: true,  track: "free" },
  { tier: 12, xp: 12000, reward: "Dark Mode UI Skin",          type: "cosmetic",  icon: "🎨", act: 2, unlocked: true,  track: "free" },
  { tier: 13, xp: 13000, reward: "15% Coupon (Partner C)",     type: "coupon",    icon: "🎟️", act: 3, unlocked: true,  track: "free" },
  { tier: 14, xp: 14000, reward: "Gold Leaderboard Frame",     type: "frame",     icon: "🖼️", act: 3, unlocked: false, track: "free" },
  { tier: 15, xp: 15000, reward: "20% Coupon + Final Boss",    type: "milestone", icon: "⭐", act: 3, unlocked: false, track: "free" },
  { tier: 16, xp: 16000, reward: "Trivia Champion Badge",      type: "badge",     icon: "🏅", act: 3, unlocked: false, track: "free" },
  { tier: 17, xp: 17000, reward: "Title: Esports Oracle",      type: "title",     icon: "🏷️", act: 3, unlocked: false, track: "free" },
  { tier: 18, xp: 18000, reward: "20% Coupon + Plat Frame",    type: "coupon",    icon: "🎟️", act: 4, unlocked: false, track: "free" },
  { tier: 19, xp: 19000, reward: "Animated Profile Border",    type: "cosmetic",  icon: "✨", act: 4, unlocked: false, track: "free" },
  { tier: 20, xp: 20000, reward: "25% Mega Coupon Bundle",     type: "milestone", icon: "⭐", act: 4, unlocked: false, track: "free" },
  { tier: 21, xp: 21000, reward: "Title: Elite Correspondent", type: "title",     icon: "🏷️", act: 4, unlocked: false, track: "free" },
  { tier: 22, xp: 22000, reward: "Rare Season Badge",          type: "badge",     icon: "🏅", act: 4, unlocked: false, track: "free" },
  { tier: 23, xp: 23000, reward: "30% Premium Coupon",         type: "coupon",    icon: "🎟️", act: 5, unlocked: false, track: "free" },
  { tier: 24, xp: 24000, reward: "Diamond Crown Frame",        type: "frame",     icon: "🖼️", act: 5, unlocked: false, track: "free" },
  { tier: 25, xp: 25000, reward: "SEASON CHAMPION + 40%",      type: "ultimate",  icon: "👑", act: 5, unlocked: false, track: "free" },
];

const PREMIUM_TIERS: Tier[] = [
  { tier: 1,  xp: 1000,  reward: "Exclusive Emblem",           type: "cosmetic",  icon: "💎", act: 1, unlocked: false, track: "premium" },
  { tier: 2,  xp: 2000,  reward: "Holographic Title",          type: "title",     icon: "🌟", act: 1, unlocked: false, track: "premium" },
  { tier: 3,  xp: 3000,  reward: "Premium Emote Pack",         type: "cosmetic",  icon: "🎭", act: 1, unlocked: false, track: "premium" },
  { tier: 4,  xp: 4000,  reward: "Animated Avatar Frame",      type: "frame",     icon: "💫", act: 1, unlocked: false, track: "premium" },
  { tier: 5,  xp: 5000,  reward: "Legendary Crate",            type: "milestone", icon: "📦", act: 1, unlocked: false, track: "premium" },
  { tier: 6,  xp: 6000,  reward: "Neon Reaction Set",          type: "cosmetic",  icon: "🌈", act: 2, unlocked: false, track: "premium" },
  { tier: 7,  xp: 7000,  reward: "Title: Mythic Reader",       type: "title",     icon: "📖", act: 2, unlocked: false, track: "premium" },
  { tier: 8,  xp: 8000,  reward: "15% Exclusive Coupon",       type: "coupon",    icon: "🎫", act: 2, unlocked: false, track: "premium" },
  { tier: 9,  xp: 9000,  reward: "Gold Animated Frame",        type: "frame",     icon: "🏆", act: 2, unlocked: false, track: "premium" },
  { tier: 10, xp: 10000, reward: "Epic Engram",                type: "milestone", icon: "🔮", act: 2, unlocked: false, track: "premium" },
  { tier: 11, xp: 11000, reward: "Prismatic Shader",           type: "cosmetic",  icon: "🎨", act: 2, unlocked: false, track: "premium" },
  { tier: 12, xp: 12000, reward: "Title: Data Miner",          type: "title",     icon: "⛏️", act: 2, unlocked: false, track: "premium" },
  { tier: 13, xp: 13000, reward: "25% Partner Coupon",         type: "coupon",    icon: "🎫", act: 3, unlocked: false, track: "premium" },
  { tier: 14, xp: 14000, reward: "Platinum Frame",             type: "frame",     icon: "🪙", act: 3, unlocked: false, track: "premium" },
  { tier: 15, xp: 15000, reward: "Exotic Engram",              type: "milestone", icon: "💠", act: 3, unlocked: false, track: "premium" },
  { tier: 16, xp: 16000, reward: "Legendary Badge",            type: "badge",     icon: "🎖️", act: 3, unlocked: false, track: "premium" },
  { tier: 17, xp: 17000, reward: "Title: Grandmaster",         type: "title",     icon: "👑", act: 3, unlocked: false, track: "premium" },
  { tier: 18, xp: 18000, reward: "30% Mega Coupon",            type: "coupon",    icon: "🎫", act: 4, unlocked: false, track: "premium" },
  { tier: 19, xp: 19000, reward: "Celestial Border",           type: "cosmetic",  icon: "🌠", act: 4, unlocked: false, track: "premium" },
  { tier: 20, xp: 20000, reward: "Ascendant Shard",            type: "milestone", icon: "💎", act: 4, unlocked: false, track: "premium" },
  { tier: 21, xp: 21000, reward: "Title: Vanguard",            type: "title",     icon: "🛡️", act: 4, unlocked: false, track: "premium" },
  { tier: 22, xp: 22000, reward: "Exotic Badge",               type: "badge",     icon: "🔱", act: 4, unlocked: false, track: "premium" },
  { tier: 23, xp: 23000, reward: "40% Premium Coupon",         type: "coupon",    icon: "🎫", act: 5, unlocked: false, track: "premium" },
  { tier: 24, xp: 24000, reward: "Ascendant Frame",            type: "frame",     icon: "⚜️", act: 5, unlocked: false, track: "premium" },
  { tier: 25, xp: 25000, reward: "MYTHIC CHAMPION BUNDLE",     type: "ultimate",  icon: "🏛️", act: 5, unlocked: false, track: "premium" },
];

const ACTS = [
  { num: 1, name: "Origin",  tiers: "T1–5" },
  { num: 2, name: "Rising",  tiers: "T6–12" },
  { num: 3, name: "Apex",    tiers: "T13–17" },
  { num: 4, name: "Siege",   tiers: "T18–22" },
  { num: 5, name: "Endgame", tiers: "T23–25" },
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

const REWARD_GRID = [
  { name: "Legendary Weapon", icon: "⚔️", level: 5,  rarity: "Legendary" },
  { name: "Enhancement Core", icon: "🔧", level: 8,  rarity: "Rare" },
  { name: "Exotic Engram",    icon: "🔮", level: 10, rarity: "Exotic" },
  { name: "Season Emblem",    icon: "🛡️", level: 12, rarity: "Legendary" },
  { name: "Bright Dust",      icon: "✨", level: 15, rarity: "Common" },
  { name: "Shader Pack",      icon: "🎨", level: 18, rarity: "Rare" },
  { name: "Exotic Emote",     icon: "💃", level: 20, rarity: "Exotic" },
  { name: "Ascendant Shard",  icon: "💎", level: 22, rarity: "Legendary" },
  { name: "Ornament Set",     icon: "👗", level: 24, rarity: "Exotic" },
  { name: "Gilded Title",     icon: "👑", level: 25, rarity: "Mythic" },
];

const RARITY_COLORS: Record<string, string> = {
  Common: "hsl(var(--muted-foreground))",
  Rare: "hsl(217 91% 60%)",
  Legendary: "hsl(263 70% 55%)",
  Exotic: "hsl(38 92% 50%)",
  Mythic: "hsl(0 84% 55%)",
};

const SEASON_CHALLENGES = [
  { name: "Read 50 articles", progress: 34, target: 50, xp: 500 },
  { name: "Complete 20 quizzes", progress: 12, target: 20, xp: 400 },
  { name: "Win 10 predictions", progress: 3, target: 10, xp: 600 },
  { name: "7-day login streak", progress: 5, target: 7, xp: 200 },
];

// ─── HELPERS ────────────────────────────────────────────────
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
  return { d, h, m, s };
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

// ─── ANIMATED XP BAR ────────────────────────────────────────
function XPBar({ percent, delay = 0, className = "" }: { percent: number; delay?: number; className?: string }) {
  return (
    <div className={`relative w-full h-3 rounded-full overflow-hidden bg-secondary ${className}`}>
      <motion.div
        className="h-full rounded-full relative overflow-hidden"
        style={{
          background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
          boxShadow: "0 0 12px hsl(186 100% 50% / 0.3)",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{
          duration: 1.2,
          delay: delay / 1000,
          type: "spring",
          stiffness: 80,
          damping: 14,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
            animation: "bp-shimmer 2s infinite",
          }}
        />
      </motion.div>
    </div>
  );
}

// ─── FLOATING XP ANIMATION ──────────────────────────────────
function FloatingXPIndicator({ amount }: { amount: number }) {
  return (
    <motion.span
      className="absolute text-sm font-bold pointer-events-none"
      style={{ color: "hsl(142 71% 45%)" }}
      initial={{ opacity: 1, y: 0, x: "-50%" }}
      animate={{ opacity: 0, y: -40, x: "-50%" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      +{amount} XP
    </motion.span>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
export default function BattlePass() {
  const [selectedTier, setSelectedTier] = useState(14);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const seasonEnd = useMemo(() => new Date(Date.now() + 63 * 86400000), []);
  const countdown = useCountdown(seasonEnd);
  const { state: xpState, floatingXPs } = useXP();

  const doneCount = quests.filter((q) => q.done).length;
  const earnedXP = quests.filter((q) => q.done).reduce((s, q) => s + q.xpReward, 0);

  // Auto-scroll to current tier
  useEffect(() => {
    if (trackRef.current) {
      const t = setTimeout(() => {
        const el = trackRef.current?.querySelector(`[data-tier="${CURRENT_TIER}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }, 400);
      return () => clearTimeout(t);
    }
  }, []);

  const completeQuest = useCallback((id: string) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === id ? { ...q, done: true, current: q.target } : q))
    );
  }, []);

  const selected = FREE_TIERS[selectedTier - 1];
  const selectedTheme = TYPE_THEMES[selected.type];

  const selectTier = (tier: number) => {
    setSelectedTier(tier);
    setShowDetail(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 md:pb-0">
      <Navbar />

      {/* Season Info Bar */}
      <div className="sticky top-[calc(3.5rem+3rem)] md:top-14 z-40 flex items-center justify-between px-4 md:px-6 py-2 bg-card border-b border-border shadow-sm">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground tracking-tight text-sm">GAME PULSE</span>
          <span className="text-xs font-bold text-primary ml-1">S1</span>
          <div className="flex md:hidden items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 ml-2">
            <Trophy className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary">RANK {CURRENT_TIER}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Ends:</span>
            <span className="font-bold text-foreground tabular-nums">
              {countdown.d}d {countdown.h}h {countdown.m}m
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">RANK {CURRENT_TIER}</span>
          </div>
        </div>
      </div>

      {/* ─── MOBILE RANK CARD ─── */}
      <div className="md:hidden p-4 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <motion.div
            className="w-16 h-16 rounded-xl bg-card border-2 border-primary/30 shadow-lg flex items-center justify-center shrink-0"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <span className="text-2xl font-black text-primary">{CURRENT_TIER}</span>
          </motion.div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground">RANK {CURRENT_TIER}</h2>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Season of the Ember</p>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="font-semibold text-foreground">Season XP</span>
                <span className="text-muted-foreground">{CURRENT_XP.toLocaleString()} / {SEASON_XP_MAX.toLocaleString()}</span>
              </div>
              <XPBar percent={(CURRENT_XP / SEASON_XP_MAX) * 100} delay={400} className="h-2" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* ─── RANK TOWER (Left Panel) ─── */}
        <aside className="hidden md:flex w-[280px] min-h-[calc(100vh-56px)] sticky top-14 border-r border-border bg-card flex-col shrink-0">
          {/* Banner image */}
          <div className="relative h-40 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&h=300&fit=crop"
              alt="Season banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          </div>

          {/* Rank display */}
          <div className="relative -mt-16 px-6 flex flex-col items-center text-center">
            <motion.div
              className="w-24 h-24 rounded-2xl bg-card border-2 border-primary/30 shadow-lg flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            >
              <span className="text-4xl font-black text-primary">{CURRENT_TIER}</span>
            </motion.div>
            <h2 className="mt-3 text-lg font-bold text-foreground tracking-tight">RANK {CURRENT_TIER}</h2>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mt-0.5">Season of the Ember</p>

            {/* Countdown */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>
                {countdown.d} Days, {countdown.h} Hours
              </span>
            </div>
          </div>

          {/* XP Progress */}
          <div className="px-6 mt-5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground">Season XP</span>
              <span className="text-muted-foreground">
                {CURRENT_XP.toLocaleString()} / {SEASON_XP_MAX.toLocaleString()}
              </span>
            </div>
            <XPBar percent={(CURRENT_XP / SEASON_XP_MAX) * 100} delay={600} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">Rank {CURRENT_TIER}</span>
              <span className="text-[10px] text-muted-foreground">Rank {CURRENT_TIER + 1}</span>
            </div>
          </div>

          {/* Current tier XP */}
          <div className="px-6 mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-foreground">To Next Rank</span>
              <span className="text-muted-foreground font-semibold">{TIER_XP_CURRENT} / {TIER_XP_MAX}</span>
            </div>
            <XPBar percent={(TIER_XP_CURRENT / TIER_XP_MAX) * 100} delay={800} />
          </div>

          <div className="mx-6 my-4 h-px bg-border" />

          {/* Season challenges */}
          <div className="px-6 flex-1">
            <h3 className="text-xs font-bold text-foreground tracking-wider uppercase mb-3 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              Season Ranks
            </h3>
            <div className="space-y-3">
              {SEASON_CHALLENGES.map((ch) => (
                <div key={ch.name}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-foreground/80 font-medium">{ch.name}</span>
                    <span className="text-muted-foreground">{ch.progress}/{ch.target}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all duration-700"
                      style={{ width: `${(ch.progress / ch.target) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* XP Bonus */}
          <div className="px-6 pb-6 mt-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
              <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs font-bold text-primary">+20% XP BONUS</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Season Pass Active</p>
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-h-[calc(100vh-56px)] overflow-x-hidden">
          {/* ─── HORIZONTAL PROGRESSION TRACK ─── */}
          <section className="border-b border-border bg-card/50 p-3 md:p-6 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 md:mb-4 gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <h2 className="text-base md:text-lg font-bold text-foreground">Progression Track</h2>
              </div>
              <div className="flex gap-1 md:gap-2 flex-wrap">
                {ACTS.map((act) => (
                  <span
                    key={act.num}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                  >
                    ACT {act.num} · {act.name}
                  </span>
                ))}
              </div>
            </div>

            {/* FREE TRACK */}
            <div className="mb-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-primary bg-primary/10 px-2 py-0.5 rounded">
                  FREE TRACK
                </span>
              </div>
              <div className="relative group">
                {/* Left scroll button */}
                <button
                  onClick={() => trackRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:shadow-primary/20 hover:shadow-md transition-all duration-200 opacity-0 group-hover:opacity-100"
                  style={{ animation: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.animation = "bp-pulse 1.5s ease-in-out infinite")}
                  onMouseLeave={(e) => (e.currentTarget.style.animation = "none")}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {/* Right scroll button */}
                <button
                  onClick={() => trackRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:shadow-primary/20 hover:shadow-md transition-all duration-200 opacity-0 group-hover:opacity-100"
                  style={{ animation: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.animation = "bp-pulse 1.5s ease-in-out infinite")}
                  onMouseLeave={(e) => (e.currentTarget.style.animation = "none")}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div
                  ref={trackRef}
                  className="overflow-x-auto pb-2 bp-scroll px-12"
                  style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
                >
                  <div className="flex gap-2 min-w-max">
                    {FREE_TIERS.map((t) => {
                      const theme = TYPE_THEMES[t.type];
                      const isCurrent = t.tier === CURRENT_TIER;
                      const isSelected = t.tier === selectedTier;
                      const isMilestone = [5, 10, 15, 20, 25].includes(t.tier);

                      return (
                        <div key={t.tier} data-tier={t.tier} className="flex flex-col items-center gap-0.5">
                          {isCurrent && (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                              ▶ NOW
                            </span>
                          )}
                          {t.tier === CURRENT_TIER + 1 && !isCurrent && (
                            <span className="text-[9px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                              NEXT
                            </span>
                          )}
                          {t.tier !== CURRENT_TIER && t.tier !== CURRENT_TIER + 1 && <div className="h-[20px]" />}

                          <span className="text-[9px] font-semibold text-muted-foreground">{t.tier}</span>

                          <motion.button
                            onClick={() => selectTier(t.tier)}
                            className="bp-card relative w-[68px] h-[80px] md:w-[85px] md:h-[98px] rounded-xl flex flex-col items-center justify-center gap-1 md:gap-1.5 cursor-pointer border-2 overflow-hidden"
                            style={{
                              background: t.unlocked ? theme.bg : "hsl(var(--secondary))",
                              borderColor: isSelected ? theme.border : t.unlocked ? theme.border + "60" : "hsl(var(--border))",
                              opacity: t.unlocked ? 1 : 0.38,
                              boxShadow: isSelected
                                ? `0 0 0 2px ${theme.border}, 0 6px 24px ${theme.border}40`
                                : isCurrent
                                ? `0 0 0 2px hsl(var(--primary)), 0 6px 20px hsl(var(--primary) / 0.25)`
                                : isMilestone && t.unlocked
                                ? `0 4px 16px ${theme.border}30`
                                : "0 2px 8px hsl(var(--foreground) / 0.04)",
                            }}
                            whileHover={{ y: -10, scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 18 }}
                          >
                            {/* Shine overlay on hover */}
                            <div className="bp-shine absolute inset-0 pointer-events-none" />

                            {!t.unlocked && (
                              <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/50" />
                            )}
                            {isMilestone && t.unlocked && (
                              <Star className="absolute top-1 left-1 w-3 h-3" style={{ color: theme.border }} />
                            )}
                            <span className="text-2xl leading-none">{t.icon}</span>
                            <span className="text-[9px] font-semibold" style={{ color: t.unlocked ? theme.text : "hsl(var(--muted-foreground))" }}>
                              {(t.xp / 1000).toFixed(0)}K XP
                            </span>
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress line */}
                  <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(CURRENT_XP / SEASON_XP_MAX) * 100}%` }}
                      transition={{ duration: 1.2, delay: 0.3, type: "spring", stiffness: 80, damping: 14 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PREMIUM TRACK */}
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-secondary text-muted-foreground px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  PREMIUM PASS
                </span>
                <span className="text-[10px] text-muted-foreground">Unlock all premium rewards</span>
              </div>
              <div className="relative group">
                <div className="overflow-x-auto pb-2 bp-scroll px-12" style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}>
                  <div className="flex gap-2 min-w-max">
                    {PREMIUM_TIERS.map((t) => {
                      const theme = TYPE_THEMES[t.type];
                      return (
                        <div key={`p-${t.tier}`} className="flex flex-col items-center gap-0.5">
                          <div className="h-[20px]" />
                          <span className="text-[9px] font-semibold text-muted-foreground/40">{t.tier}</span>
                          <div
                            className="bp-card relative w-[68px] h-[80px] md:w-[85px] md:h-[98px] rounded-xl flex flex-col items-center justify-center gap-1 md:gap-1.5 border-2 opacity-40 cursor-not-allowed overflow-hidden"
                            style={{
                              background: "hsl(var(--secondary))",
                              borderColor: "hsl(var(--border))",
                            }}
                          >
                            <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/30" />
                            <span className="text-2xl leading-none grayscale">{t.icon}</span>
                            <span className="text-[9px] font-semibold text-muted-foreground/50">
                              {(t.xp / 1000).toFixed(0)}K XP
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── SELECTED TIER DETAIL ─── */}
          <AnimatePresence mode="wait">
            {showDetail && (
              <motion.section
                key={selectedTier}
                {...fadeUp}
                className="p-6 border-b border-border"
              >
               <div
                  className="rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 border shadow-sm"
                  style={{
                    background: selectedTheme.bg,
                    borderColor: selectedTheme.border + "40",
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: selectedTheme.border }}>
                        TIER {selected.tier}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-card text-muted-foreground border border-border">
                        ACT {selected.act} · {ACTS[selected.act - 1]?.name}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase"
                        style={{ background: selectedTheme.border + "18", color: selectedTheme.text }}
                      >
                        {selected.type}
                      </span>
                    </div>
                    <div className="text-5xl mb-3">{selected.icon}</div>
                    <p className="font-bold text-base text-foreground">{selected.reward}</p>
                    <div className="mt-3 max-w-[300px]">
                      <XPBar
                        percent={selected.unlocked ? 100 : Math.min(100, (CURRENT_XP / selected.xp) * 100)}
                        delay={200}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {selected.unlocked ? "100" : Math.floor((CURRENT_XP / selected.xp) * 100)}% progress
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end justify-center">
                    <p className="text-2xl md:text-3xl font-black" style={{ color: selectedTheme.border }}>
                      {selected.xp.toLocaleString()} XP
                    </p>
                    {selected.unlocked ? (
                      <span className="mt-2 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        ✓ UNLOCKED
                      </span>
                    ) : (
                      <div className="text-right mt-2">
                        <p className="text-sm text-muted-foreground font-medium">
                          {(selected.xp - CURRENT_XP).toLocaleString()} XP away
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 hidden sm:block">
                          ≈ {Math.ceil((selected.xp - CURRENT_XP) / 200)} days at avg pace
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ─── REWARD GRID ─── */}
          <section className="p-3 md:p-6 border-b border-border">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Gift className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h2 className="text-base md:text-lg font-bold text-foreground">Detailed Rewards</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
              {REWARD_GRID.map((r) => {
                const unlocked = r.level <= CURRENT_TIER;
                const rarityColor = RARITY_COLORS[r.rarity] || "hsl(var(--muted-foreground))";
                return (
                  <motion.div
                    key={r.name}
                    className="bp-card rounded-xl border bg-card p-3 md:p-5 text-center cursor-pointer relative overflow-hidden"
                    style={{
                      opacity: unlocked ? 1 : 0.55,
                      borderColor: unlocked ? rarityColor + "40" : "hsl(var(--border))",
                      boxShadow: unlocked ? `0 4px 16px ${rarityColor}20` : "none",
                    }}
                    whileHover={{
                      y: -10,
                      scale: 1.1,
                      boxShadow: unlocked ? `0 8px 32px ${rarityColor}40` : "0 4px 16px hsl(var(--foreground) / 0.08)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  >
                    <div className="bp-shine absolute inset-0 pointer-events-none" />
                    {!unlocked && (
                      <Lock className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
                    )}
                    <span className="text-3xl md:text-4xl block mb-2">{r.icon}</span>
                    <p className="text-xs font-bold text-foreground mb-0.5">{r.name}</p>
                    <p className="text-[10px] font-semibold" style={{ color: rarityColor }}>
                      {r.rarity}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Level {r.level}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* ─── BOTTOM: QUESTS + BONUSES ─── */}
          <section className="p-3 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Daily Quests */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Daily Quests</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-6 h-1.5 rounded-full transition-colors"
                        style={{
                          background: i < doneCount ? "hsl(142 71% 45%)" : "hsl(var(--secondary))",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">{doneCount}/7</span>
                </div>
              </div>

              <div className="space-y-2">
                {quests.map((q) => (
                  <motion.div
                    key={q.id}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-all"
                    style={{
                      opacity: q.done ? 0.65 : 1,
                      borderColor: q.done ? "hsl(142 71% 45% / 0.3)" : "hsl(var(--border))",
                    }}
                    layout
                  >
                    <span className="text-xl w-8 text-center">{q.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: q.done ? "hsl(142 71% 45%)" : "hsl(var(--foreground))" }}>
                          {q.title}
                        </span>
                        {q.done && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">DONE</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{q.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(q.current / q.target) * 100}%`,
                              background: q.done ? "hsl(142 71% 45%)" : "hsl(var(--primary))",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{q.current}/{q.target}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold min-w-[45px] text-right" style={{ color: q.done ? "hsl(142 71% 45%)" : "hsl(var(--primary))" }}>
                      {q.xpReward} XP
                    </span>
                    {!q.done && (
                      <button
                        onClick={() => completeQuest(q.id)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                      >
                        GO →
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Pass Bonuses */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Pass Bonuses</h2>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-primary">+20% XP BONUS</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Active for all XP sources</p>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-primary" />
                    Streak Multipliers
                  </h4>
                  <div className="space-y-2">
                    {[
                      { range: "Day 1–2", mult: "1.0×", active: true },
                      { range: "Day 3–6", mult: "1.2×", active: false },
                      { range: "Day 7–13", mult: "1.5×", active: false },
                      { range: "Day 14–29", mult: "1.75×", active: false },
                      { range: "Day 30+", mult: "2.0×", active: false },
                    ].map((s) => (
                      <div key={s.range} className="flex justify-between items-center text-xs">
                        <span className={s.active ? "text-foreground font-semibold" : "text-muted-foreground"}>
                          {s.range}
                        </span>
                        <span className={s.active ? "text-primary font-bold" : "text-muted-foreground"}>
                          {s.mult}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-xs font-bold text-foreground mb-2">XP Earned Today</h4>
                  <p className="text-2xl font-black text-primary">{earnedXP}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Daily cap: 400 XP</p>
                  <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, (earnedXP / 400) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Next 3 unlocks */}
                <div className="rounded-xl border bg-card p-4">
                  <h4 className="text-xs font-bold text-foreground mb-3">Next Unlocks</h4>
                  <div className="space-y-2.5">
                    {FREE_TIERS.filter((t) => !t.unlocked).slice(0, 3).map((t) => {
                      const theme = TYPE_THEMES[t.type];
                      const prog = Math.min(100, (CURRENT_XP / t.xp) * 100);
                      return (
                        <button
                          key={t.tier}
                          onClick={() => selectTier(t.tier)}
                          className="w-full flex items-center gap-2 text-left hover:bg-secondary/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                        >
                          <span className="text-lg">{t.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-foreground truncate">{t.reward}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${prog}%`, background: theme.border }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground">T{t.tier}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Floating XP indicators */}
      <div className="fixed bottom-8 left-0 md:left-[280px] z-50 pointer-events-none flex justify-center w-full md:w-[calc(100%-280px)]">
        <AnimatePresence>
          {floatingXPs.map((f) => (
            <FloatingXPIndicator key={f.id} amount={f.amount} />
          ))}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes bp-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes bp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes bp-shine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .bp-card .bp-shine {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 70%, transparent 100%);
          width: 60%;
          top: 0;
          bottom: 0;
          left: -100%;
          position: absolute;
        }
        .bp-card:hover .bp-shine {
          animation: bp-shine 0.6s ease-out forwards;
        }
        .bp-scroll::-webkit-scrollbar { width: 3px; height: 4px; }
        .bp-scroll::-webkit-scrollbar-track { background: transparent; }
        .bp-scroll::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 3px; }
      `}</style>
      <BottomNavBar />
    </div>
  );
}
