import { Home, Trophy, Swords, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const BOTTOM_NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Users, label: "Hub", href: "/hub" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
];

export function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around h-14">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
