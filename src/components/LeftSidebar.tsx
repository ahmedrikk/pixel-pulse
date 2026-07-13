import { Home, Trophy, Users, Swords, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { UserProfileWidget } from "@/components/sidebar/UserProfileWidget";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Users, label: "Hub", href: "/hub" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
  { icon: Star, label: "Reviews", href: "/reviews" },
];

export function LeftSidebar() {
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
            <item.icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
