import { CalendarDays, Gift, Home, Trophy, Users, Swords, Star, ScrollText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { UserProfileWidget } from "@/components/sidebar/UserProfileWidget";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Users, label: "Hub", href: "/hub" },
  { icon: Gift, label: "Free Games", href: "/free-games" },
  { icon: ScrollText, label: "Game Patch", href: "/game-patch" },
  { icon: CalendarDays, label: "Game Calendar", href: "/game-calendar" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
  { icon: Star, label: "Reviews", href: "/reviews" },
];

export function LeftSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-full space-y-3">
      {/* User Profile Widget */}
      <UserProfileWidget />

      {/* Main Navigation */}
      <nav className="overflow-hidden rounded-xl border bg-card p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-foreground transition-colors hover:bg-secondary",
                isActive && "bg-secondary font-semibold"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px] text-muted-foreground", isActive && "text-primary")} />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
