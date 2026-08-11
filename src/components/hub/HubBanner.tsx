import { useState } from "react";

export type HubTab = "all" | "trivia" | "higher-lower" | "sentiment" | "hype";

interface HubBannerProps {
  activeTab: HubTab;
  setActiveTab: (tab: HubTab) => void;
}

export function HubBanner({ activeTab, setActiveTab }: HubBannerProps) {
  const tabs: { id: HubTab; label: string; dot?: boolean }[] = [
    { id: "all", label: "Everything" },
    { id: "trivia", label: "Trivia" },
    { id: "higher-lower", label: "Higher or Lower" },
    { id: "sentiment", label: "Sentiment" },
    { id: "hype", label: "Hype Meter" },
  ];

  return (
    <div
      style={{
        background: "#0A1628",
        padding: "18px 20px 0",
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px 12px 0 0",
        marginBottom: 0,
      }}
    >
      {/* CSS Orbs */}
      <div
        style={{
          width: 220, height: 220,
          background: "#3d59e0", opacity: 0.09,
          position: "absolute", top: -80, right: 30,
          borderRadius: "50%", pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 140, height: 140,
          background: "#0D9488", opacity: 0.07,
          position: "absolute", bottom: -40, right: 180,
          borderRadius: "50%", pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
          Community Hub
        </p>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#fff", marginBottom: 3 }}>
          The <span style={{ color: "#818CF8", fontStyle: "normal" }}>Hub</span>
        </h1>
        <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.38)", marginBottom: 12, lineHeight: 1.5 }}>
          Where the community plays, votes, remembers, and lives games.
        </p>

        {/* Filter Tabs */}
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 14px",
                fontSize: "0.75rem",
                color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.35)",
                fontWeight: activeTab === tab.id ? 500 : 400,
                cursor: "pointer",
                borderBottom: activeTab === tab.id ? "2px solid #3d59e0" : "2px solid transparent",
                whiteSpace: "nowrap",
                background: "transparent",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.id ? "#3d59e0" : "transparent",
                position: "relative",
              }}
            >
              {tab.label}
              {tab.dot && (
                <span
                  style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "#DC2626",
                    position: "absolute", top: 7, right: 4,
                    display: "inline-block",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
