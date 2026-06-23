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
        bg-white/10 border border-white/15
        ${reward.blurred ? "opacity-60" : "opacity-100"}`}
      style={{ filter: reward.blurred ? "blur(0.5px)" : "none" }}
    >
      {/* Icon */}
      <div
        className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 text-sm bg-white/15"
      >
        {reward.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white m-0 truncate">
          {reward.name}
        </p>
        <p className="text-[9px] text-white/55 mt-[1px] m-0">
          {reward.type} · Tier {reward.tier}
        </p>
      </div>

      {/* Tier badge */}
      <span
        className="text-[9px] font-semibold px-[6px] py-[2px] rounded-lg whitespace-nowrap flex-shrink-0 bg-white/20 text-white"
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
     * Intentional brand-gradient promo card. It reads identically in light
     * and dark mode (a deliberate violet→blue brand moment), so it never
     * looks like "the dark box in a light page". All inner text/surfaces use
     * white-alpha so contrast holds against the gradient in both themes.
     */
    <div className="bg-brand-gradient rounded-xl p-4 overflow-hidden relative card-shadow">
      {/* ── Season Header Row ── */}
      <div className="flex items-center justify-between mb-[10px]">
        {/* Left label */}
        <span className="text-[9px] font-semibold tracking-[0.07em] uppercase text-white/55">
          Season {seasonNumber} · Free Battle Pass
        </span>

        {/* Live dot */}
        <div className="flex items-center gap-1">
          <div className="w-[5px] h-[5px] rounded-full bg-emerald-300" />
          <span className="text-[9px] text-white/55">Live</span>
        </div>
      </div>

      {/* ── Headline ── */}
      <p className="text-[15px] font-semibold leading-[1.3] mb-1 text-white">
        Unlock real rewards while you read
      </p>

      {/* ── Subheadline ── */}
      <p className="text-[11px] leading-[1.4] mb-[14px] text-white/65">
        Read articles, predict matches, review games — every action earns XP toward these rewards.
      </p>

      {/* ── Rewards Grid ── */}
      <div className="flex flex-col gap-[6px] mb-[14px]">
        {rewards.map((reward) => (
          <RewardRow key={`${reward.name}-${reward.tier}`} reward={reward} />
        ))}
      </div>

      {/* ── Divider ── */}
      <div className="h-px mb-3 bg-white/15" />

      {/* ── XP Signup Row ── */}
      <div className="flex items-center gap-[7px] mb-3">
        {/* XP badge */}
        <span className="text-[10px] font-semibold px-2 py-[3px] rounded-[10px] whitespace-nowrap bg-white/20 text-white">
          +{signupXpBonus} XP on sign up
        </span>

        {/* Hint */}
        <span className="text-[10px] leading-[1.3] text-white/55">
          Free to join — no credit card
        </span>
      </div>

      {/* ── CTA Button ── */}
      <button
        id="bp-promo-cta"
        onClick={() => openAuthModal("battlepass")}
        className="
          w-full h-9 rounded-lg text-[12px] font-semibold border-none cursor-pointer
          bg-white text-primary hover:bg-white/90
          transition-colors duration-150
        "
      >
        Join free and start earning →
      </button>

      {/* ── Footer Note ── */}
      <p className={`text-center mt-[7px] text-[10px] mb-0 ${isUrgent ? "text-red-200" : "text-white/50"}`}>
        {totalTiers} tiers · Season ends in {daysRemaining} days
      </p>
    </div>
  );
}
