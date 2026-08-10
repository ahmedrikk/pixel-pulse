import { Link, useLocation } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { TalusLogo } from "@/components/TalusLogo";
import { requestHomeFeedRefresh } from "@/lib/refreshFeed";

interface NavbarProps {
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar(_props: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur-md">
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-5">
        {/* Left spacer for centering the logo */}
        <div className="flex-1" />

        {/* Centered Talus logo */}
        <Link
          to="/"
          onClick={(event) => { if (pathname === "/") { event.preventDefault(); requestHomeFeedRefresh(); } }}
          aria-label="Talus home"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        >
          <TalusLogo size={32} />
        </Link>

        {/* Account actions live in the left profile widget. */}
        <div className="flex items-center justify-end gap-2 flex-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" title="Toggle theme" aria-label="Toggle light and dark theme">
            {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px] text-primary" />}
          </Button>
        </div>
      </div>
    </nav>
  );
}
