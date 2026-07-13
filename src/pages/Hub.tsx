import { useState } from "react";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { SiteLayout } from "@/components/SiteLayout";
import { HubBanner } from "@/components/hub/HubBanner";
import { TriviaSection } from "@/components/hub/TriviaSection";
import { HypeMeterSection } from "@/components/hub/HypeMeterSection";

type HubTab = "all" | "trivia" | "hype";

export function HubContent() {
  const [activeTab, setActiveTab] = useState<HubTab>("all");

  const show = (section: HubTab) => activeTab === "all" || activeTab === section;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SiteLayout>
        <HubBanner
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div
          className="overflow-hidden rounded-b-xl border border-t-0 bg-card"
        >
          {show("trivia") && (
            <TriviaSection />
          )}
          {show("hype") && (
            <HypeMeterSection />
          )}
        </div>
      </SiteLayout>

      <BottomNavBar />
      <Footer />
    </div>
  );
}

export default function Hub() {
  return <HubContent />;
}
