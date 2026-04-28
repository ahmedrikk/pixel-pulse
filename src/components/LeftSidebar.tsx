import { Home, Star, Trophy, Swords, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useXP } from "@/contexts/XPContext";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { Button } from "@/components/ui/button";
import { BattlePassPromoWidget } from "@/components/sidebar/BattlePassPromoWidget";
import { CategoryPillsWidget } from "@/components/sidebar/CategoryPillsWidget";
import { UserProfileWidget } from "@/components/sidebar/UserProfileWidget";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Leaderboard", href: "/leaderboard" },
];

export function LeftSidebar() {
  const { state } = useXP();
  const { isAuthenticated } = useAuthGate();
  const bpProgress = (state.currentLevelXP / state.xpForNextLevel) * 100;

  return (
    <aside className="w-full lg:w-64 space-y-4">
      {/* User Profile Widget */}
      <UserProfileWidget />

      {/* Main Navigation */}
      <nav className="bg-card rounded-lg border card-shadow overflow-hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-foreground hover:text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* ── Conditional: Battle Pass section ── */}
      {isAuthenticated ? (
        /* Auth view: XP progress card */
        <div className="bg-card rounded-lg border overflow-hidden card-shadow">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">Battle Pass</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
                <span className="text-base font-black text-primary">{state.level}</span>
              </div>
              <div>
                <p className="text-sm font-bold">Level {state.level}</p>
                <p className="text-xs text-muted-foreground">Season of the Ember</p>
              </div>
            </div>
            <div className="relative h-2 w-full rounded-full bg-secondary/60 overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${bpProgress}%`,
                  background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(186 100% 50%))",
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {state.currentLevelXP} / {state.xpForNextLevel} XP
            </p>
            <Button asChild variant="secondary" className="w-full gap-2 text-xs">
              <Link to="/battle-pass">
                Explore Battle Pass
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        /* Guest view: Battle Pass Promo Widget */
        <BattlePassPromoWidget />
      )}

      {/* ── Category Pills Widget (shown to ALL users) ── */}
      <CategoryPillsWidget />
    </aside>
  );
}
