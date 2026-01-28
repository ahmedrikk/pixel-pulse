import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileMenu } from "@/components/MobileMenu";

const Index = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <div className="container py-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Fixed/Sticky with internal scroll */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-20 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <LeftSidebar />
            </div>
          </div>

          {/* Main Feed - Scrollable */}
          <div className="flex-1 min-w-0">
            <NewsFeed />
          </div>

          {/* Right Sidebar - Fixed/Sticky with internal scroll */}
          <div className="hidden xl:block flex-shrink-0">
            <div className="sticky top-20 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <RightSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
