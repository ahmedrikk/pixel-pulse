import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";

interface XPState {
  totalXP: number;
  level: number;
  currentLevelXP: number;
  xpForNextLevel: number;
}

interface FloatingXP {
  id: string;
  amount: number;
  timestamp: number;
}

interface XPContextType {
  state: XPState;
  addXP: (amount: number) => void;
  floatingXPs: FloatingXP[];
  justLeveledUp: boolean;
  clearLevelUp: () => void;
}

const XP_STORAGE_KEY = "gt_xp_data";
const LOGIN_KEY = "gt_daily_login";

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function computeState(totalXP: number): XPState {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { totalXP, level, currentLevelXP: remaining, xpForNextLevel: xpForLevel(level) };
}

function loadXP(): number {
  try {
    return parseInt(localStorage.getItem(XP_STORAGE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

const XPContext = createContext<XPContextType | null>(null);

export function XPProvider({ children }: { children: ReactNode }) {
  const [totalXP, setTotalXP] = useState(loadXP);
  const [floatingXPs, setFloatingXPs] = useState<FloatingXP[]>([]);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const prevLevelRef = useRef(computeState(loadXP()).level);

  // Daily login bonus
  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(LOGIN_KEY) !== today) {
      localStorage.setItem(LOGIN_KEY, today);
      // Delay so user sees the animation
      setTimeout(() => addXP(25), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addXP = useCallback((amount: number) => {
    setTotalXP((prev) => {
      const next = prev + amount;
      localStorage.setItem(XP_STORAGE_KEY, String(next));
      return next;
    });
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingXPs((prev) => [...prev, { id, amount, timestamp: Date.now() }]);
    setTimeout(() => {
      setFloatingXPs((prev) => prev.filter((f) => f.id !== id));
    }, 1500);
  }, []);

  const state = computeState(totalXP);

  // Detect level up
  useEffect(() => {
    if (state.level > prevLevelRef.current) {
      setJustLeveledUp(true);
      setTimeout(() => setJustLeveledUp(false), 3000);
    }
    prevLevelRef.current = state.level;
  }, [state.level]);

  const clearLevelUp = useCallback(() => setJustLeveledUp(false), []);

  return (
    <XPContext.Provider value={{ state, addXP, floatingXPs, justLeveledUp, clearLevelUp }}>
      {children}
    </XPContext.Provider>
  );
}

export function useXP() {
  const ctx = useContext(XPContext);
  if (!ctx) throw new Error("useXP must be used within XPProvider");
  return ctx;
}
