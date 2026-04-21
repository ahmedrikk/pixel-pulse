import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { BottomNavBar } from "@/components/BottomNavBar";
import { HubBanner } from "@/components/hub/HubBanner";
import { StreamerSection } from "@/components/hub/StreamerSection";
import { TriviaSection } from "@/components/hub/TriviaSection";
import { HotTakesSection } from "@/components/hub/HotTakesSection";
import { HypeMeterSection } from "@/components/hub/HypeMeterSection";
import { useAuthGate } from "@/contexts/AuthGateContext";
import { TagFilterProvider } from "@/contexts/TagFilterContext";

type HubTab = "all" | "streamers" | "trivia" | "takes" | "hype";

// Matches live count from mock data — in production this would come from the streamer hook
const LIVE_STREAMERS_COUNT = 2;

export function HubContent() {
  const [activeTab, setActiveTab] = useState<HubTab>("all");
  const { isAuthenticated } = useAuthGate();

  const show = (section: HubTab) => activeTab === "all" || activeTab === section;

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />

      <div className="container py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <div className="sticky top-20 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <LeftSidebar />
            </div>
          </div>

          {/* Centre Column */}
          <div className="flex-1 min-w-0">
            {/* Hub Banner with tabs */}
            <HubBanner
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              liveStreamersCount={LIVE_STREAMERS_COUNT}
            />

            {/* Sections */}
            <div
              style={{
                border: "0.5px solid hsl(var(--border))",
                borderTop: "none",
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
                background: "hsl(var(--card))",
              }}
            >
              {show("streamers") && (
                <StreamerSection isAuthenticated={isAuthenticated} />
              )}
              {show("trivia") && (
                <TriviaSection />
              )}
              {show("takes") && (
                <HotTakesSection />
              )}
              {show("hype") && (
                <HypeMeterSection />
              )}
            </div>
          </div>

          {/* Right Sidebar */}
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

// TagFilterProvider is required by LeftSidebar's useTagFilter hook
export default function Hub() {
  return (
    <TagFilterProvider>
      <HubContent />
    </TagFilterProvider>
  );
}
