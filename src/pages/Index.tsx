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
          {/* Left Sidebar - Hidden on mobile */}
          <div className="hidden lg:block">
            <LeftSidebar />
          </div>

          {/* Main Feed */}
          <NewsFeed />

          {/* Right Sidebar - Hidden on tablet and mobile */}
          <div className="hidden xl:block">
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
