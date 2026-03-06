import { useState } from "react";
import { Navbar } from "./Navbar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { MobileMenu } from "./MobileMenu";
import { TagFilterProvider } from "@/contexts/TagFilterContext";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <TagFilterProvider>
      <div className="min-h-screen bg-background">
        <Navbar
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        <div className="container py-6">
          <div className="flex gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block flex-shrink-0">
              <div className="sticky top-20 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <LeftSidebar />
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {children}
            </div>

            {/* Right Sidebar */}
            <div className="hidden xl:block flex-shrink-0">
              <div className="sticky top-20 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <RightSidebar />
              </div>
            </div>
          </div>
        </div>
      </div>
    </TagFilterProvider>
  );
}
