import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { TalusLogo } from "@/components/TalusLogo";
import { MobileMenu } from "@/components/MobileMenu";
import { requestHomeFeedRefresh } from "@/lib/refreshFeed";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setIsMobileMenuOpen(false);
    };
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur-md">
        <div className="relative flex h-16 items-center justify-between px-4 sm:px-5">
          <div className="flex flex-1 items-center justify-start">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <Link
            to="/"
            onClick={(event) => { if (pathname === "/") { event.preventDefault(); requestHomeFeedRefresh(); } }}
            aria-label="Talus home"
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          >
            <TalusLogo size={32} />
          </Link>

          <div className="flex flex-1 flex-shrink-0 items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" title="Toggle theme" aria-label="Toggle light and dark theme">
              {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px] text-primary" />}
            </Button>
          </div>
        </div>
      </nav>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
}
