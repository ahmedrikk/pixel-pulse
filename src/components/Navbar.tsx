import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Sun, Moon, LogOut, LogIn } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

interface NavbarProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar({}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);

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
    <nav className="sticky top-0 z-50 w-full border-b border-nav-border bg-nav backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg flex-shrink-0">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span>
            Level<span className="text-primary">Up</span><span className="text-accent">XP</span>
          </span>
        </Link>

        {/* Right: theme toggle + auth */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" title="Toggle theme">
            {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px] text-primary" />}
          </Button>

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
    </nav>
  );
}
