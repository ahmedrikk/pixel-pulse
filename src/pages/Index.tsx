import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { TagFilterProvider, useTagFilter } from "@/contexts/TagFilterContext";
import { useEngagementTracker } from "@/hooks/useEngagementTracker";
import { useXP } from "@/contexts/XPContext";
import { useAuthGate } from "@/contexts/AuthGateContext";

// Top-10 category lookup so we can resolve name from slug on URL init
const SLUG_TO_NAME: Record<string, string> = {
  PlayStation: "PlayStation",
  GTA6: "GTA 6",
  Esports: "Esports",
  PCGaming: "PC Gaming",
  FPS: "FPS",
  RPG: "RPG",
  Nintendo: "Nintendo",
  Xbox: "Xbox",
  Indie: "Indie Games",
  Streaming: "Streaming",
};

// Inner component so it can use TagFilterContext
function IndexContent() {
  const { addXP } = useXP();
  const { trackCardView } = useEngagementTracker(addXP);
  const [searchParams] = useSearchParams();
  const { setActiveTag, setCategoryName } = useTagFilter();

  // Initialise category filter from URL on first render (shallow routing)
  useEffect(() => {
    const slug = searchParams.get("category");
    if (slug) {
      setActiveTag(slug);
      setCategoryName(SLUG_TO_NAME[slug] ?? slug);
    }
    // Only run on mount — intentionally no deps on searchParams so URL changes
    // driven by pill clicks don't double-fire (pills update state directly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />

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

      <BottomNavBar />
    </div>
  );
}

const Index = () => (
  <TagFilterProvider>
    <IndexContent />
  </TagFilterProvider>
);

export default Index;
