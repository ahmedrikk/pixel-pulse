import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "levelupxp_progression";

interface XPState {
  level: number;
  currentXP: number;
  totalXP: number;
}

interface FloatingXP {
  id: string;
  amount: number;
  x: number;
  y: number;
}

function xpForLevel(level: number): number {
  return Math.floor(500 * Math.pow(1.4, level - 1));
}

function loadState(): XPState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { level: 1, currentXP: 0, totalXP: 0 };
}

export function useXPSystem() {
  const [state, setState] = useState<XPState>(loadState);
  const [floatingXPs, setFloatingXPs] = useState<FloatingXP[]>([]);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const articleCounter = useRef(0);
  const scrollMilestone = useRef(0);

  const xpNeeded = xpForLevel(state.level);
  const progress = Math.min((state.currentXP / xpNeeded) * 100, 100);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addXP = useCallback((amount: number, sourceX?: number, sourceY?: number) => {
    // floating indicator
    const id = crypto.randomUUID();
    const x = sourceX ?? window.innerWidth / 2;
    const y = sourceY ?? 120;
    setFloatingXPs((prev) => [...prev, { id, amount, x, y }]);
    setTimeout(() => setFloatingXPs((prev) => prev.filter((f) => f.id !== id)), 1500);

    setState((prev) => {
      let newXP = prev.currentXP + amount;
      let newLevel = prev.level;
      let needed = xpForLevel(newLevel);

      while (newXP >= needed) {
        newXP -= needed;
        newLevel++;
        needed = xpForLevel(newLevel);
        setJustLeveledUp(true);
        setTimeout(() => setJustLeveledUp(false), 3000);
      }

      return { level: newLevel, currentXP: newXP, totalXP: prev.totalXP + amount };
    });
  }, []);

  const trackArticleView = useCallback((cardId: string) => {
    articleCounter.current++;
    if (articleCounter.current % 10 === 0) {
      addXP(50);
    }
  }, [addXP]);

  const trackScroll = useCallback(() => {
    const viewports = window.scrollY / window.innerHeight;
    const milestone = Math.floor(viewports / 6);
    if (milestone > scrollMilestone.current) {
      scrollMilestone.current = milestone;
      addXP(25);
    }
  }, [addXP]);

  // scroll listener
  useEffect(() => {
    window.addEventListener("scroll", trackScroll, { passive: true });
    return () => window.removeEventListener("scroll", trackScroll);
  }, [trackScroll]);

  // daily login XP
  useEffect(() => {
    const lastLogin = localStorage.getItem("levelupxp_last_login");
    const today = new Date().toDateString();
    if (lastLogin !== today) {
      localStorage.setItem("levelupxp_last_login", today);
      setTimeout(() => addXP(25), 1500);
    }
  }, [addXP]);

  return {
    level: state.level,
    currentXP: state.currentXP,
    xpNeeded,
    progress,
    totalXP: state.totalXP,
    floatingXPs,
    justLeveledUp,
    addXP,
    trackArticleView,
  };
}
