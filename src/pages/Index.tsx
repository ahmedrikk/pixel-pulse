import { Navbar } from "@/components/Navbar";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { NewsFeed } from "@/components/NewsFeed";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { TagFilterProvider } from "@/contexts/TagFilterContext";
import { SoftBlockAuthModal } from "@/components/SoftBlockAuthModal";
import { useEngagementTracker } from "@/hooks/useEngagementTracker";
import { useXP } from "@/contexts/XPContext";

const Index = () => {
  const { addXP } = useXP();
  const { shouldShowModal, dismiss, trackCardView } = useEngagementTracker(addXP);

  return (
    <TagFilterProvider>
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
        <SoftBlockAuthModal isOpen={shouldShowModal} onDismiss={dismiss} />
      </div>
    </TagFilterProvider>
  );
};

export default Index;
