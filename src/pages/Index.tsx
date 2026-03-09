import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileMenu } from "@/components/MobileMenu";
import { TagFilterProvider } from "@/contexts/TagFilterContext";
import { SoftBlockAuthModal } from "@/components/SoftBlockAuthModal";
import { useEngagementTracker } from "@/hooks/useEngagementTracker";
import { FloatingXPIndicators } from "@/components/FloatingXPIndicators";
import { useXP } from "@/contexts/XPContext";

const Index = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { shouldShowModal, dismiss, trackCardView } = useEngagementTracker();
  const { trackArticleView } = useXP();

  const handleCardView = (cardId: string) => {
    trackCardView(cardId);
    trackArticleView(cardId);
  };

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
              <NewsFeed onCardView={handleCardView} />
            </div>

            <div className="hidden xl:block flex-shrink-0">
              <div className="sticky top-20 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <RightSidebar />
              </div>
            </div>
          </div>
        </div>

        <SoftBlockAuthModal isOpen={shouldShowModal} onDismiss={dismiss} />
        <FloatingXPIndicators />
      </div>
    </TagFilterProvider>
  );
};

export default Index;
