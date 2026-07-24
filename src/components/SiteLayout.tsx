import { useState } from "react";
import { Navbar } from "./Navbar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { MobileMenu } from "./MobileMenu";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
      <div className="min-h-screen">
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <div className="talus-shell">
            {/* Left Sidebar */}
            <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 self-start overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border lg:block">
              <LeftSidebar />
            </div>

            {/* Main Content */}
            <div className="talus-main-column">
              <Navbar
                onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                isMobileMenuOpen={isMobileMenuOpen}
              />
              <div className="px-3 py-3 sm:px-4 sm:py-4">
                {children}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 self-start overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border xl:block">
              <RightSidebar />
            </div>
        </div>
      </div>
  );
}
