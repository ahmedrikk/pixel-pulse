import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Search, Sun, Moon, Menu, X, User, LogOut, Trophy } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { XPProgressBar } from "./XPProgressBar";

interface NavbarProps {
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

export function Navbar({ onMenuToggle, isMobileMenuOpen }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-nav-border bg-nav backdrop-blur-sm">
      <div className="container flex h-14 items-center gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuToggle}
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>

        {/* Logo */}
        <a href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="relative">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <span className="hidden sm:inline">
            Game<span className="text-primary">Pulse</span>
          </span>
        </a>

        {/* Search Bar - Center */}
        <div className="flex-1 max-w-xl mx-auto hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search gaming news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-0 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* XP Progress Bar - Show for logged in users */}
          {user && (
            <div className="hidden lg:block">
              <XPProgressBar compact />
            </div>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5 text-primary" />
            )}
          </Button>

          {/* Leaderboard Link */}
          <Link to="/leaderboard">
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Trophy className="h-5 w-5" />
            </Button>
          </Link>

          {/* Auth Buttons */}
          {user ? (
            <>
              <Link to="/profile">
                <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {user.email?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" className="hidden sm:flex">
                  Log In
                </Button>
              </Link>
              <Link to="/login">
                <Button className="hidden sm:flex">
                  Create Account
                </Button>
              </Link>
              <Link to="/login" className="sm:hidden">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
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

      {/* Mobile XP Bar */}
      {user && (
        <div className="lg:hidden px-4 pb-3">
          <XPProgressBar />
        </div>
      )}
    </nav>
  );
}
