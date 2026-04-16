import { useAuthGate } from "@/contexts/AuthGateContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromoReward {
  name: string;
  type: string;
  tier: number;
  icon: string;
  iconBg: string;
  badgeBg: string;
  badgeColor: string;
  blurred?: boolean;
}

interface BattlePassPromoProps {
  seasonName?: string;
  seasonNumber?: number;
  daysRemaining?: number;
  totalTiers?: number;
  rewards?: PromoReward[];
  signupXpBonus?: number;
  isActive?: boolean;
}

// ─── Static mock data (Section 8.1 + 2.4) ────────────────────────────────────

const DEFAULT_REWARDS: PromoReward[] = [
  {
    name: "Newcomer Badge",
    type: "Profile badge",
    tier: 1,
    icon: "🏅",
    iconBg: "rgba(59,130,246,0.15)",
    badgeBg: "rgba(59,130,246,0.15)",
    badgeColor: "#93C5FD",
  },
  {
    name: "Title: Press Start",
    type: "Profile title",
    tier: 2,
    icon: "🏷️",
    iconBg: "rgba(139,92,246,0.15)",
    badgeBg: "rgba(139,92,246,0.15)",
    badgeColor: "#C4B5FD",
  },
  {
    name: "5% Gaming Coupon",
    type: "Discount reward",
    tier: 3,
    icon: "🎟️",
    iconBg: "rgba(16,185,129,0.15)",
    badgeBg: "rgba(16,185,129,0.15)",
    badgeColor: "#6EE7B7",
  },
  {
    name: "10% Coupon + Title",
    type: "Milestone reward",
    tier: 5,
    icon: "⭐",
    iconBg: "rgba(245,158,11,0.15)",
    badgeBg: "rgba(245,158,11,0.15)",
    badgeColor: "#FCD34D",
    blurred: true,
  },
];

// ─── Reward Row ───────────────────────────────────────────────────────────────

function RewardRow({ reward }: { reward: PromoReward }) {
  return (
    <div
      className={`flex items-center gap-[9px] px-[10px] py-2 rounded-lg
        bg-black/[0.06] dark:bg-white/[0.06]
        border border-black/[0.08] dark:border-white/[0.08]
        ${reward.blurred ? "opacity-60" : "opacity-100"}`}
      style={{ filter: reward.blurred ? "blur(0.5px)" : "none" }}
    >
      {/* Icon */}
      <div
        className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 text-sm"
        style={{ background: reward.iconBg }}
      >
        {reward.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-foreground m-0 truncate">
          {reward.name}
        </p>
        <p className="text-[9px] text-muted-foreground mt-[1px] m-0">
          {reward.type} · Tier {reward.tier}
        </p>
      </div>

      {/* Tier badge */}
      <span
        className="text-[9px] font-medium px-[6px] py-[2px] rounded-lg whitespace-nowrap flex-shrink-0"
        style={{ background: reward.badgeBg, color: reward.badgeColor }}
      >
        T{reward.tier}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BattlePassPromoWidget({
  seasonName = "Season of the Ember",
  seasonNumber = 1,
  daysRemaining = 63,
  totalTiers = 25,
  rewards = DEFAULT_REWARDS,
  signupXpBonus = 50,
  isActive = true,
}: BattlePassPromoProps) {
  const { openAuthModal } = useAuthGate();

  if (!isActive || daysRemaining <= 0) return null;

  const isUrgent = daysRemaining <= 7;

  return (
    /*
     * Container:
     *   Light — soft indigo-tinted surface (slate-100 + indigo tint) with a
     *           visible border so it sits naturally in the white sidebar.
     *   Dark  — deep navy (#0F2347 equivalent via indigo-950) — same as before.
     */
    <div
      className="
        rounded-xl p-4 overflow-hidden relative
        bg-indigo-50 border border-indigo-100
        dark:bg-[#0F2347] dark:border-transparent
      "
    >
      {/* ── Season Header Row ── */}
      <div className="flex items-center justify-between mb-[10px]">
        {/* Left label */}
        <span
          className="
            text-[9px] font-medium tracking-[0.07em] uppercase
            text-indigo-400 dark:text-white/40
          "
        >
          Season {seasonNumber} · Free Battle Pass
        </span>

        {/* Live dot */}
        <div className="flex items-center gap-1">
          <div className="w-[5px] h-[5px] rounded-full bg-emerald-500" />
          <span className="text-[9px] text-indigo-400 dark:text-white/40">Live</span>
        </div>
      </div>

      {/* ── Headline ── */}
      <p
        className="
          text-[15px] font-medium leading-[1.3] mb-1
          text-indigo-900 dark:text-white
        "
      >
        Unlock real rewards while you read
      </p>

      {/* ── Subheadline ── */}
      <p
        className="
          text-[11px] leading-[1.4] mb-[14px]
          text-indigo-500 dark:text-white/45
        "
      >
        Read articles, predict matches, review games — every action earns XP toward these rewards.
      </p>

      {/* ── Rewards Grid ── */}
      <div className="flex flex-col gap-[6px] mb-[14px]">
        {rewards.map((reward) => (
          <RewardRow key={`${reward.name}-${reward.tier}`} reward={reward} />
        ))}
      </div>

      {/* ── Divider ── */}
      <div
        className="
          h-[0.5px] mb-3
          bg-indigo-200 dark:bg-white/[0.08]
        "
      />

      {/* ── XP Signup Row ── */}
      <div className="flex items-center gap-[7px] mb-3">
        {/* Amber badge */}
        <span
          className="
            text-[10px] font-medium px-2 py-[3px] rounded-[10px] whitespace-nowrap
            bg-amber-100 border border-amber-300 text-amber-700
            dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300
          "
        >
          +{signupXpBonus} XP on sign up
        </span>

        {/* Hint */}
        <span
          className="text-[10px] leading-[1.3] text-indigo-400 dark:text-white/40"
        >
          Free to join — no credit card
        </span>
      </div>

      {/* ── CTA Button ── */}
      <button
        id="bp-promo-cta"
        onClick={() => openAuthModal("battlepass")}
        className="
          w-full h-9 rounded-lg text-[12px] font-medium text-white border-none cursor-pointer
          bg-[#534AB7] hover:bg-[#3C3489]
          transition-colors duration-150
        "
      >
        Join free and start earning →
      </button>

      {/* ── Footer Note ── */}
      <p
        className={`
          text-center mt-[7px] text-[10px] mb-0
          ${isUrgent
            ? "text-red-400/70 dark:text-red-400/60"
            : "text-indigo-400 dark:text-white/30"
          }
        `}
      >
        {totalTiers} tiers · Season ends in {daysRemaining} days
      </p>
    </div>
  );
}
