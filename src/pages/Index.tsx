import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { useEngagementTracker } from "@/hooks/useEngagementTracker";
import { useAuthGate } from "@/contexts/AuthGateContext";

// Inner component so it can use TagFilterContext
function IndexContent() {
  const { trackCardView } = useEngagementTracker();
  const { openSignupPrompt } = useAuthGate();
  const location = useLocation();

  // Open auth modal when redirected from /login or /signup
  useEffect(() => {
    if ((location.state as { openAuth?: boolean } | null)?.openAuth) {
      window.history.replaceState({}, "");
      openSignupPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <div className="talus-shell">
          <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 self-start overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border lg:block">
            <LeftSidebar />
          </div>

          <div className="talus-main-column">
            <Navbar />
            <div className="px-3 py-3 sm:px-4 sm:py-4">
              <NewsFeed onCardView={trackCardView} />
            </div>
          </div>

          <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] min-w-0 self-start overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border xl:block">
            <RightSidebar />
          </div>
      </div>

      <BottomNavBar />
      <Footer />
    </div>
  );
}

const Index = () => <IndexContent />;

export default Index;
