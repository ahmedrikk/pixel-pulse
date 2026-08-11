import { Bell, CalendarDays, Gift, Home, Trophy, Star, ScrollText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { UserProfileWidget } from "@/components/sidebar/UserProfileWidget";
import { cn } from "@/lib/utils";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useNotifications } from "@/hooks/useNotifications";
import { requestHomeFeedRefresh } from "@/lib/refreshFeed";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Gift, label: "Free Games", href: "/free-games" },
  { icon: ScrollText, label: "Game Patch", href: "/game-patch" },
  { icon: CalendarDays, label: "Game Calendar", href: "/game-calendar" },
  { icon: Star, label: "Game Ratings", href: "/reviews" },
];

export function LeftSidebar() {
  const { pathname } = useLocation();
  const { user } = useAuthGate();
  const { data: notifications = [] } = useNotifications(user?.id);
  const unread = notifications.filter((item) => !item.readAt).length;

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
              onClick={(event) => { if (item.href === "/" && pathname === "/") { event.preventDefault(); requestHomeFeedRefresh(); } }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-foreground transition-colors hover:bg-secondary",
                isActive && "bg-secondary font-semibold"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px] text-muted-foreground", isActive && "text-primary")} />
              <span className="text-sm">{item.label}</span>
              {item.href === "/notifications" && unread > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-tiny-label font-bold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
