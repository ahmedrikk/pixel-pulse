import { X, Star, Trophy, Sun, Moon, Settings, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const MOCK_USER = {
  initials: "GT",
  displayName: "GamerTag_X",
  handle: "@gamertag",
  bio: "Indie game enthusiast & RPG lover. Always hunting for hidden gems. 🎮",
  following: 142,
  followers: 891,
};

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

  if (!isOpen) return null;

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
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black text-foreground"
            style={{ background: "linear-gradient(135deg, hsl(142 71% 45%), hsl(186 100% 50%))" }}>
            {MOCK_USER.initials}
          </div>
          <h3 className="mt-3 font-bold text-base text-foreground">{MOCK_USER.displayName}</h3>
          <p className="text-sm text-muted-foreground">{MOCK_USER.handle}</p>
          <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{MOCK_USER.bio}</p>

          {/* Followers / Following */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-foreground">{MOCK_USER.following}</span>
              <span className="text-sm text-muted-foreground">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-foreground">{MOCK_USER.followers}</span>
              <span className="text-sm text-muted-foreground">Followers</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Navigation Links */}
        <nav className="py-2">
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

        {/* Settings */}
        <Link
          to="/settings"
          onClick={onClose}
          className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary transition-colors"
        >
          <Settings className="h-5 w-5 text-foreground" />
          <span className="font-medium text-foreground">Settings and privacy</span>
        </Link>

        {/* Bottom Auth Buttons */}
        <div className="mt-auto p-4 border-t border-border">
          <div className="space-y-2">
            <Button variant="outline" className="w-full">Log In</Button>
            <Button className="w-full">Sign Up</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
