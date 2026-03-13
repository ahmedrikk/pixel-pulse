import { useState } from "react";
import { TrendingUp, Search, Home, Bell, Trophy, Swords, Sun, Moon, User, LogIn } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavLink } from "@/components/NavLink";

interface NavbarProps {
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
];

export function Navbar({ onMenuToggle, isMobileMenuOpen }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  // TODO: Replace with real auth state
  const isLoggedIn = false;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-nav-border bg-nav backdrop-blur-sm">
      <div className="container flex h-14 items-center gap-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 font-bold text-lg flex-shrink-0">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">
            Level<span className="text-primary">Up</span><span className="text-accent">XP</span>
          </span>
        </a>

        {/* Search Bar - Compact */}
        <div className="w-44 hidden md:block flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm bg-secondary border-0 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Center Nav Icons */}
        <div className="flex items-center justify-center flex-1 gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.href}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              activeClassName="text-primary bg-primary/10 hover:text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium hidden lg:block">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
            {theme === "light" ? (
              <Moon className="h-4.5 w-4.5" />
            ) : (
              <Sun className="h-4.5 w-4.5 text-primary" />
            )}
          </Button>

          {/* Auth */}
          {isLoggedIn ? (
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <User className="h-5 w-5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:flex text-xs h-9">
                <LogIn className="h-4 w-4 mr-1" />
                Log In
              </Button>
              <Button size="sm" className="hidden sm:flex text-xs h-9">
                Sign Up
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9">
                <User className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search gaming news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-0"
          />
        </div>
      </div>
    </nav>
  );
}
