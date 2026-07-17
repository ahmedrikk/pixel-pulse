import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "@/components/BottomNavBar";
import { Footer } from "@/components/Footer";
import { SiteLayout } from "@/components/SiteLayout";
import { HubBanner, type HubTab } from "@/components/hub/HubBanner";
import { TriviaSection } from "@/components/hub/TriviaSection";
import { HypeMeterSection } from "@/components/hub/HypeMeterSection";
import { HigherLowerSection, HistorySection, SentimentSection } from "@/components/hub/HubEngagementWidgets";

export function HubContent() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<HubTab>("all");
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const show = (section: HubTab) => activeTab === "all" || activeTab === section;

  useEffect(() => {
    const anchor = location.hash.slice(1);
    if (!anchor) return;
    const tabByAnchor: Record<string, HubTab> = {
      trivia: "trivia", "higher-lower": "higher-lower", sentiment: "sentiment", "hype-meter": "hype",
    };
    if (anchor === "history") setActiveTab("all");
    else if (tabByAnchor[anchor]) setActiveTab(tabByAnchor[anchor]);
    const timer = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlighted(anchor);
      window.setTimeout(() => setHighlighted(null), 1800);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  const sectionClass = (id: string) => `scroll-mt-4 transition-shadow duration-500 ${highlighted === id ? "relative z-10 ring-2 ring-[#534AB7] ring-offset-2" : ""}`;

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
            <div id="trivia" className={sectionClass("trivia")}><TriviaSection /></div>
          )}
          {show("higher-lower") && (
            <div id="higher-lower" className={sectionClass("higher-lower")}><HigherLowerSection /></div>
          )}
          {show("sentiment") && (
            <div id="sentiment" className={sectionClass("sentiment")}><SentimentSection /></div>
          )}
          {activeTab === "all" && (
            <div id="history" className={sectionClass("history")}><HistorySection /></div>
          )}
          {show("hype") && (
            <div id="hype-meter" className={sectionClass("hype-meter")}><HypeMeterSection /></div>
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
