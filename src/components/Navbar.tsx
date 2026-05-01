import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Search, Home, Trophy, Swords, Sun, Moon, User, LogOut, LogIn, Users, Bell } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { XPProgressBar } from "./XPProgressBar";
import { NavLink } from "@/components/NavLink";
import { ProfileDrawer } from "@/components/ProfileDrawer";

interface NavbarProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Trophy, label: "Esports", href: "/esports" },
  { icon: Users, label: "Hub", href: "/hub" },
  { icon: Swords, label: "Battle Pass", href: "/battle-pass" },
];

export function Navbar({ onMenuToggle, isMobileMenuOpen }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-nav-border bg-nav backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-3">
          {/* Mobile: Profile avatar (left) */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="md:hidden flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-foreground overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(142 71% 45%), hsl(186 100% 50%))" }}
          >
            {user ? (
              user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />
                : user.email?.[0]?.toUpperCase()
            ) : "?"}
          </button>

          {/* Desktop: Logo */}
          <Link to="/" className="hidden md:flex items-center gap-2 font-bold text-lg flex-shrink-0">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">
              Level<span className="text-primary">Up</span><span className="text-accent">XP</span>
            </span>
          </Link>

          {/* Mobile: Centered Logo */}
          <div className="md:hidden flex-1 flex justify-center">
            <Link to="/" className="flex items-center gap-1.5 font-bold text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>
                Level<span className="text-primary">Up</span><span className="text-accent">XP</span>
              </span>
            </Link>
          </div>

          {/* Desktop: Search Bar */}
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

          {/* Desktop: Center Nav Icons */}
          <div className="hidden md:flex items-center justify-center flex-1 gap-1">
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

          {/* Right Side */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Theme Toggle — desktop only */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 hidden md:flex">
              {theme === "light" ? (
                <Moon className="h-4.5 w-4.5" />
              ) : (
                <Sun className="h-4.5 w-4.5 text-primary" />
              )}
            </Button>

            {/* Notification Bell — desktop logged-in only */}
            {user && (
              <Link to="/notifications">
                <Button variant="ghost" size="icon" className="relative h-9 w-9 hidden md:flex">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    0
                  </span>
                </Button>
              </Link>
            )}

            {/* XP Progress Bar — desktop logged-in only */}
            {user && (
              <div className="hidden lg:block">
                <XPProgressBar compact />
              </div>
            )}

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center gap-1.5">
              {user ? (
                <>
                  <Link to="/profile">
                    <Avatar src={user.user_metadata?.avatar_url} fallback={user.email} size="md" />
                  </Link>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogout} title="Logout">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="text-xs h-9">
                      <LogIn className="h-4 w-4 mr-1" />
                      Log In
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="sm" className="text-xs h-9">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Drawer for mobile */}
      <ProfileDrawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
