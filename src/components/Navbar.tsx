import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { TalusLogo } from "@/components/TalusLogo";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { useProfile } from "@/contexts/ProfileContext";

interface NavbarProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar(_props: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { openSignupPrompt } = useAuthGate();
  const { profile } = useProfile();
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
    <nav className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur-md">
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-5">
        {/* Left spacer for centering the logo */}
        <div className="flex-1" />

        {/* Centered Talus logo */}
        <Link
          to="/"
          aria-label="Talus home"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        >
          <TalusLogo size={32} />
        </Link>

        {/* Right: theme toggle + auth */}
        <div className="flex items-center justify-end gap-2 flex-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" title="Toggle theme">
            {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px] text-primary" />}
          </Button>

          {user ? (
            <>
              <Link to="/profile">
                <Avatar src={profile?.avatar_url || user.user_metadata?.avatar_url} fallback={profile?.display_name || profile?.username || user.email} size="md" />
              </Link>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleLogout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <button
              onClick={openSignupPrompt}
              className="whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary sm:px-3"
            >
              Sign Up / Log In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
