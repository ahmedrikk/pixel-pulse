import { Bell, CalendarDays, Gift, Home, Trophy, Star, ScrollText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { requestHomeFeedRefresh } from "@/lib/refreshFeed";

const BOTTOM_NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Bell, label: "Alerts", href: "/notifications" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Gift, label: "Free", href: "/free-games" },
  { icon: ScrollText, label: "Patches", href: "/game-patch" },
  { icon: CalendarDays, label: "Calendar", href: "/game-calendar" },
  { icon: Star, label: "Ratings", href: "/reviews" },
];

export function BottomNavBar() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around h-14">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            onClick={(event) => { if (item.href === "/" && pathname === "/") { event.preventDefault(); requestHomeFeedRefresh(); } }}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-tiny-label leading-tight">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
