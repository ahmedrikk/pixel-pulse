import { useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { TagFilterProvider, useTagFilter } from "@/contexts/TagFilterContext";
import { useEngagementTracker } from "@/hooks/useEngagementTracker";
import { useXP } from "@/contexts/XPContext";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { prettifyTag } from "@/hooks/useTrendingCategories";

// Inner component so it can use TagFilterContext
function IndexContent() {
  const { addXP } = useXP();
  const { trackCardView } = useEngagementTracker(addXP);
  const [searchParams] = useSearchParams();
  const { setActiveTag, setCategoryName } = useTagFilter();
  const { openSignupPrompt } = useAuthGate();
  const location = useLocation();

  // The ?category= URL param is the single source of truth for the feed
  // filter. Category pills navigate to /?category=slug (from any page), and
  // the back button navigates to /, so we sync the filter on every change.
  const categorySlug = searchParams.get("category");
  useEffect(() => {
    if (categorySlug) {
      setActiveTag(categorySlug);
      setCategoryName(prettifyTag(categorySlug));
    } else {
      setActiveTag(null);
      setCategoryName(null);
    }
  }, [categorySlug, setActiveTag, setCategoryName]);

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
          <div className="hidden lg:block min-w-0">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <LeftSidebar />
            </div>
          </div>

          <div className="talus-main-column">
            <Navbar />
            <div className="px-3 py-3 sm:px-4 sm:py-4">
              <NewsFeed onCardView={trackCardView} />
            </div>
          </div>

          <div className="hidden xl:block min-w-0">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <RightSidebar />
            </div>
          </div>
      </div>

      <BottomNavBar />
      <Footer />
    </div>
  );
}

const Index = () => (
  <TagFilterProvider>
    <IndexContent />
  </TagFilterProvider>
);

export default Index;
