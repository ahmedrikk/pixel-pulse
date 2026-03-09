import { createContext, useContext, ReactNode } from "react";
import { useXPSystem } from "@/hooks/useXPSystem";

type XPContextType = ReturnType<typeof useXPSystem>;

const XPContext = createContext<XPContextType | null>(null);

export function XPProvider({ children }: { children: ReactNode }) {
  const xp = useXPSystem();
  return <XPContext.Provider value={xp}>{children}</XPContext.Provider>;
}

export function useXP() {
  const ctx = useContext(XPContext);
  if (!ctx) throw new Error("useXP must be used within XPProvider");
  return ctx;
}
