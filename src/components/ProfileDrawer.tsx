import { useState, useEffect } from "react";
import { X, Star, Trophy, Sun, Moon, Settings, ChevronRight, LogIn, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

const NAV_LINKS = [
  { icon: Star, label: "Reviews", href: "/reviews" },
  { icon: Trophy, label: "Esports", href: "/esports" },
];

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
  const { theme, toggleTheme } = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!isOpen) return null;

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";
  const handle = user?.email ? `@${user.email.split("@")[0]}` : "";
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="absolute left-0 top-0 h-full w-[280px] bg-card border-r border-border shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
        {/* Header with close */}
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-semibold text-muted-foreground">Account</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Profile Section */}
        <div className="px-4 pb-4">
          <Avatar src={user?.user_metadata?.avatar_url} fallback={displayName} size="lg" />
          <h3 className="mt-3 font-bold text-base text-foreground">{displayName}</h3>
          {handle && <p className="text-sm text-muted-foreground">{handle}</p>}
        </div>

        <div className="border-t border-border" />

        {/* Navigation Links */}
        <nav className="py-2">
          {user && (
            <Link
              to="/profile"
              onClick={onClose}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-4">
                <Settings className="h-5 w-5 text-foreground" />
                <span className="font-medium text-foreground">My Profile</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              onClick={onClose}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-4">
                <item.icon className="h-5 w-5 text-foreground" />
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </nav>

        <div className="border-t border-border" />

        {/* Dark Mode Toggle */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {theme === "light" ? (
              <Moon className="h-5 w-5 text-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-primary" />
            )}
            <span className="font-medium text-foreground">Dark Mode</span>
          </div>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={toggleTheme}
          />
        </div>

        <div className="border-t border-border" />

        {/* Bottom Auth */}
        <div className="mt-auto p-4 border-t border-border">
          {user ? (
            <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          ) : (
            <div className="space-y-2">
              <Link to="/login" onClick={onClose}>
                <Button variant="outline" className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  Log In
                </Button>
              </Link>
              <Link to="/login" onClick={onClose}>
                <Button className="w-full">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
