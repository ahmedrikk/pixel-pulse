import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileMenu } from "@/components/MobileMenu";
import { TagFilterProvider } from "@/contexts/TagFilterContext";
import { useEngagementTracker } from "@/hooks/useEngagementTracker";
import { useXP } from "@/contexts/XPContext";
import { useAuthGate } from "@/contexts/AuthGateContext";

const Index = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { addXP } = useXP();
  const { shouldShowModal, dismiss, trackCardView } = useEngagementTracker(addXP);
  const { openSignupPrompt, isAuthenticated } = useAuthGate();

  // Trigger auth modal when engagement tracker wants to show soft block
  useEffect(() => {
    if (shouldShowModal && !isAuthenticated) {
      openSignupPrompt();
      dismiss();
    }
  }, [shouldShowModal, isAuthenticated, openSignupPrompt, dismiss]);

  return (
    <TagFilterProvider>
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
            <div className="hidden lg:block flex-shrink-0">
              <div className="sticky top-20 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <LeftSidebar />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <NewsFeed onCardView={trackCardView} />
            </div>

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
};

export default Index;
